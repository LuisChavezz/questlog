// @vitest-environment node
// Tests de publicar un comentario sin el RPC de TanStack Start: se prueba
// `createQuestCommentHandler` directamente, con `#/db` mockeado por el stub y
// los resolvers de auth de guild mockeados. Cubre los gates, la reverificación
// bloqueada (orden quests → guild_members), el reintento por deadlock y la
// forma de la fila devuelta.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { guildQuestComments, quests, user } from '#/db/schema'
import {
  enqueueError,
  enqueueInsert,
  enqueueSelect,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import { createQuestCommentHandler } from './create-quest-comment.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('#/features/guilds/api/resolve-guild-quest-auth', () => ({
  resolveGuildQuestAuth: vi.fn(),
  resolveLockedGuildQuestAuth: vi.fn(),
}))

const QUEST = '11111111-1111-4111-8111-111111111111'
const GUILD = 'guild-1'
const GM = 'u-gm'
const MEMBER = 'u-member'

const POST_CONFLICT =
  'Conflict: the quest changed while posting your comment — please refresh and try again'

function payload() {
  return { questId: QUEST, body: 'Need help with the dragon' }
}

function authContext(viewerId = MEMBER) {
  return {
    viewer: { viewerId, viewerRole: 'member' as const, ownerId: GM },
    roleByUserId: new Map([[viewerId, 'member' as const]]),
  }
}

// Fila que devuelve el INSERT ... RETURNING.
function insertedRow() {
  return {
    id: 'c-new',
    questId: QUEST,
    authorId: MEMBER,
    body: 'Need help with the dragon',
    createdAt: new Date('2026-07-20T10:00:00.123Z'),
    editedAt: null,
  }
}

function authorRow() {
  return {
    authorName: 'Ada Lovelace',
    authorEmail: 'ada@example.com',
    authorImage: null,
    authorAvatarId: null,
  }
}

// Índice en `getDbCalls()` en el momento en que se toman las membresías
// bloqueadas — el resolver está mockeado, así que no deja su propio registro.
let callsBeforeMembershipLock = -1

// Camino feliz: quest de guild, observador miembro, transacción que inserta.
function setupAllowed() {
  enqueueSelect([{ guildId: GUILD }]) // comprobación previa
  vi.mocked(resolveGuildQuestAuth).mockResolvedValue(authContext())
  enqueueSelect([authorRow()]) // autor, en la comprobación previa
  enqueueSelect([{ guildId: GUILD }]) // quest bloqueada
  vi.mocked(resolveLockedGuildQuestAuth).mockImplementation(async () => {
    callsBeforeMembershipLock = getDbCalls().length
    return authContext()
  })
  enqueueInsert([insertedRow()])
}

function deadlockError() {
  return new Error('Failed query: insert into "guild_quest_comments"', {
    cause: Object.assign(new Error('deadlock detected'), { code: '40P01' }),
  })
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
  callsBeforeMembershipLock = -1
})

describe('createQuestCommentHandler — gates', () => {
  it('lanza Not Found si la quest no existe', async () => {
    enqueueSelect([])

    await expect(createQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Not Found: quest not found',
    )
  })

  it('lanza Not Found para una quest personal, sin abrir transacción', async () => {
    enqueueSelect([{ guildId: null }])

    await expect(createQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Not Found: quest not found',
    )
    expect(resolveGuildQuestAuth).not.toHaveBeenCalled()
    expect(resolveLockedGuildQuestAuth).not.toHaveBeenCalled()
  })

  it('lanza Forbidden si el observador no es miembro y no inserta nada', async () => {
    enqueueSelect([{ guildId: GUILD }])
    vi.mocked(resolveGuildQuestAuth).mockRejectedValue(
      new Error('Forbidden: you are not a member of this guild'),
    )

    await expect(
      createQuestCommentHandler(payload(), 'u-stranger'),
    ).rejects.toThrow('Forbidden: you are not a member of this guild')
    expect(getDbCalls().some((call) => call.op === 'insert')).toBe(false)
  })
})

describe('createQuestCommentHandler — escritura', () => {
  it('inserta el comentario del observador y lo devuelve con la forma del lector', async () => {
    setupAllowed()

    const item = await createQuestCommentHandler(payload(), MEMBER)

    const insert = getDbCalls().find((call) => call.op === 'insert')
    expect(insert?.table).toBe(guildQuestComments)
    expect(insert?.values).toEqual({
      questId: QUEST,
      authorId: MEMBER,
      body: 'Need help with the dragon',
    })
    expect(item).toEqual({
      id: 'c-new',
      body: 'Need help with the dragon',
      createdAt: new Date('2026-07-20T10:00:00.123Z'),
      editedAt: null,
      author: {
        id: MEMBER,
        name: 'Ada Lovelace',
        image: null,
        avatarId: null,
        initials: 'AL',
      },
      canEdit: true,
      canDelete: true,
    })
  })

  it('bloquea la quest y DESPUÉS las membresías, sin relatedUserIds', async () => {
    setupAllowed()

    await createQuestCommentHandler(payload(), MEMBER)

    const calls = getDbCalls()
    // [0] quest y [1] autor: comprobación previa, sin bloqueo. [2] quest
    // bloqueada.
    expect(calls[0]).toMatchObject({
      op: 'select',
      table: quests,
      locked: false,
    })
    expect(calls[1]).toMatchObject({ op: 'select', table: user, locked: false })
    expect(calls[2]).toMatchObject({
      op: 'select',
      table: quests,
      locked: true,
    })
    // Las membresías se bloquean justo después de la quest y antes del INSERT.
    expect(callsBeforeMembershipLock).toBe(3)
    expect(calls[3]).toMatchObject({ op: 'insert' })
    expect(resolveLockedGuildQuestAuth).toHaveBeenCalledWith(
      expect.anything(),
      GUILD,
      MEMBER,
    )
  })

  it('no lee el autor mientras retiene los bloqueos', async () => {
    setupAllowed()

    await createQuestCommentHandler(payload(), MEMBER)

    // Ningún SELECT a `user` después del primer bloqueo: la sección crítica
    // solo contiene la reverificación y el INSERT.
    const calls = getDbCalls()
    const firstLock = calls.findIndex((call) => call.locked)
    expect(firstLock).toBeGreaterThan(-1)
    expect(calls.slice(firstLock).some((call) => call.table === user)).toBe(
      false,
    )
  })
})

describe('createQuestCommentHandler — reverificación bloqueada', () => {
  it('lanza Conflict si la quest se borró entre la comprobación y el bloqueo', async () => {
    enqueueSelect([{ guildId: GUILD }])
    vi.mocked(resolveGuildQuestAuth).mockResolvedValue(authContext())
    enqueueSelect([authorRow()]) // autor, en la comprobación previa
    enqueueSelect([]) // la relectura bloqueada ya no la encuentra

    await expect(createQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      POST_CONFLICT,
    )
    expect(resolveLockedGuildQuestAuth).not.toHaveBeenCalled()
    expect(getDbCalls().some((call) => call.op === 'insert')).toBe(false)
  })

  it('propaga el rechazo de la membresía bloqueada sin insertar', async () => {
    enqueueSelect([{ guildId: GUILD }])
    vi.mocked(resolveGuildQuestAuth).mockResolvedValue(authContext())
    enqueueSelect([authorRow()]) // autor, en la comprobación previa
    enqueueSelect([{ guildId: GUILD }])
    vi.mocked(resolveLockedGuildQuestAuth).mockRejectedValue(
      new Error('Forbidden: you are not a member of this guild'),
    )

    await expect(createQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Forbidden: you are not a member of this guild',
    )
    expect(getDbCalls().some((call) => call.op === 'insert')).toBe(false)
  })
})

describe('createQuestCommentHandler — reintento por deadlock', () => {
  it('repite la transacción entera una vez y la segunda pasada gana', async () => {
    enqueueSelect([{ guildId: GUILD }])
    vi.mocked(resolveGuildQuestAuth).mockResolvedValue(authContext())
    enqueueSelect([authorRow()]) // autor, en la comprobación previa
    vi.mocked(resolveLockedGuildQuestAuth).mockResolvedValue(authContext())
    enqueueSelect([{ guildId: GUILD }]) // bloqueo, intento 1
    enqueueError('insert', deadlockError())
    enqueueSelect([{ guildId: GUILD }]) // bloqueo, intento 2
    enqueueInsert([insertedRow()])

    const item = await createQuestCommentHandler(payload(), MEMBER)

    expect(item.id).toBe('c-new')
    // Cada intento vuelve a bloquear la quest desde cero.
    expect(
      getDbCalls().filter((call) => call.table === quests && call.locked),
    ).toHaveLength(2)
    expect(resolveLockedGuildQuestAuth).toHaveBeenCalledTimes(2)
  })

  it('con el deadlock persistente devuelve el Conflict genérico, sin el texto de Postgres', async () => {
    enqueueSelect([{ guildId: GUILD }])
    vi.mocked(resolveGuildQuestAuth).mockResolvedValue(authContext())
    enqueueSelect([authorRow()]) // autor, en la comprobación previa
    vi.mocked(resolveLockedGuildQuestAuth).mockResolvedValue(authContext())
    enqueueSelect([{ guildId: GUILD }])
    enqueueError('insert', deadlockError())
    enqueueSelect([{ guildId: GUILD }])
    enqueueError('insert', deadlockError())

    const error = await createQuestCommentHandler(payload(), MEMBER).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(POST_CONFLICT)
    expect((error as Error).message).not.toContain('deadlock')
  })
})
