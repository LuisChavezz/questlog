// @vitest-environment node
// Tests de editar un comentario sin el RPC de TanStack Start: se prueba
// `updateQuestCommentHandler` directamente, con `#/db` mockeado por el stub y
// los resolvers de auth de guild mockeados. Cubre los gates, quién puede editar
// (solo el autor), la reverificación bloqueada en el orden quests →
// guild_members → comentario, el reintento por deadlock y que un cuerpo sin
// cambios no marque `edited_at`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import type { GuildRole } from '#/db/schema'
import { guildQuestComments, quests, user } from '#/db/schema'
import {
  enqueueError,
  enqueueSelect,
  enqueueUpdate,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import type { UpdateQuestCommentValues } from '../schemas/quest-comment-schemas'
import { updateQuestCommentHandler } from './update-quest-comment.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('#/features/guilds/api/resolve-guild-quest-auth', () => ({
  resolveGuildQuestAuth: vi.fn(),
  resolveLockedGuildQuestAuth: vi.fn(),
}))

const QUEST = '11111111-1111-4111-8111-111111111111'
const COMMENT = '22222222-2222-4222-8222-222222222222'
const GUILD = 'guild-1'
const GM = 'u-gm'
const MEMBER = 'u-member'
const OTHER = 'u-other'

const EDIT_CONFLICT =
  'Conflict: the comment changed while saving — please refresh and try again'

const dialect = new PgDialect()

function payload(
  overrides: Partial<UpdateQuestCommentValues> = {},
): UpdateQuestCommentValues {
  return {
    questId: QUEST,
    commentId: COMMENT,
    body: 'Edited body',
    ...overrides,
  }
}

function authContext(viewerId: string, viewerRole: GuildRole = 'member') {
  return {
    viewer: { viewerId, viewerRole, ownerId: GM },
    roleByUserId: new Map([[viewerId, viewerRole]]),
  }
}

function commentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT,
    authorId: MEMBER,
    body: 'Original body',
    createdAt: new Date('2026-07-20T10:00:00.123Z'),
    editedAt: null,
    ...overrides,
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

let callsBeforeMembershipLock = -1

// Comprobación previa: quest de guild, comentario y autor (el observador). La
// fila del autor sobra en los casos que fallan antes: la cola no se consume.
function setupPreCheck(opts: {
  viewerId: string
  viewerRole?: GuildRole
  comment?: Record<string, unknown> | null
}) {
  const ctx = authContext(opts.viewerId, opts.viewerRole)
  enqueueSelect([{ guildId: GUILD }])
  vi.mocked(resolveGuildQuestAuth).mockResolvedValue(ctx)
  enqueueSelect(opts.comment === null ? [] : [commentRow(opts.comment)])
  enqueueSelect([authorRow()])
  vi.mocked(resolveLockedGuildQuestAuth).mockImplementation(async () => {
    callsBeforeMembershipLock = getDbCalls().length
    return ctx
  })
}

// Un intento de la transacción: quest bloqueada y comentario bloqueado.
function enqueueAttempt(lockedComment: Record<string, unknown> | null = {}) {
  enqueueSelect([{ guildId: GUILD }])
  enqueueSelect(lockedComment === null ? [] : [commentRow(lockedComment)])
}

function writes() {
  return getDbCalls().filter((call) => call.op === 'update')
}

function deadlockError() {
  return new Error('Failed query: update "guild_quest_comments"', {
    cause: Object.assign(new Error('deadlock detected'), { code: '40P01' }),
  })
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
  callsBeforeMembershipLock = -1
})

describe('updateQuestCommentHandler — gates', () => {
  it('lanza Not Found si la quest no existe', async () => {
    enqueueSelect([])

    await expect(updateQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Not Found: quest not found',
    )
  })

  it('lanza Not Found para una quest personal', async () => {
    enqueueSelect([{ guildId: null }])

    await expect(updateQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Not Found: quest not found',
    )
    expect(resolveGuildQuestAuth).not.toHaveBeenCalled()
  })

  it('lanza Forbidden si el observador no es miembro del guild', async () => {
    enqueueSelect([{ guildId: GUILD }])
    vi.mocked(resolveGuildQuestAuth).mockRejectedValue(
      new Error('Forbidden: you are not a member of this guild'),
    )

    await expect(updateQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Forbidden: you are not a member of this guild',
    )
  })

  it('lanza Not Found si el comentario no existe en ESA quest', async () => {
    setupPreCheck({ viewerId: MEMBER, comment: null })

    await expect(updateQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Not Found: comment not found',
    )
    // La lectura se acota por comentario Y quest.
    const read = getDbCalls()[1]
    expect(read.table).toBe(guildQuestComments)
    expect(dialect.sqlToQuery(read.where as SQL).params).toEqual([
      COMMENT,
      QUEST,
    ])
  })
})

describe('updateQuestCommentHandler — quién edita', () => {
  it('el autor edita su comentario y marca edited_at con clock_timestamp()', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt()
    enqueueUpdate([
      commentRow({
        body: 'Edited body',
        editedAt: new Date('2026-07-21T09:00:00.000Z'),
      }),
    ])

    const item = await updateQuestCommentHandler(payload(), MEMBER)

    const [write] = writes()
    expect(write.table).toBe(guildQuestComments)
    expect(write.set?.body).toBe('Edited body')
    // `clock_timestamp()` de Postgres: ni un Date de la app ni `now()`.
    expect(dialect.sqlToQuery(write.set?.editedAt as SQL).sql).toBe(
      'clock_timestamp()',
    )
    expect(dialect.sqlToQuery(write.where as SQL).params).toEqual([
      COMMENT,
      QUEST,
    ])
    expect(item).toMatchObject({
      id: COMMENT,
      body: 'Edited body',
      editedAt: new Date('2026-07-21T09:00:00.000Z'),
      canEdit: true,
    })
  })

  it('el Guild Master NO edita comentarios ajenos (Forbidden)', async () => {
    setupPreCheck({ viewerId: GM, viewerRole: 'owner' })

    await expect(updateQuestCommentHandler(payload(), GM)).rejects.toThrow(
      'Forbidden: you can only edit your own comments',
    )
    expect(writes()).toHaveLength(0)
  })

  it('otro miembro no edita el comentario (Forbidden)', async () => {
    setupPreCheck({ viewerId: OTHER })

    await expect(updateQuestCommentHandler(payload(), OTHER)).rejects.toThrow(
      'Forbidden: you can only edit your own comments',
    )
  })

  it('un comentario huérfano no lo edita nadie, ni el Guild Master', async () => {
    setupPreCheck({
      viewerId: GM,
      viewerRole: 'owner',
      comment: { authorId: null },
    })

    await expect(updateQuestCommentHandler(payload(), GM)).rejects.toThrow(
      'Forbidden: you can only edit your own comments',
    )
  })
})

describe('updateQuestCommentHandler — cuerpo sin cambios', () => {
  it('no escribe ni marca edited_at si el cuerpo recortado es el mismo', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt({ body: 'Same body' })

    const item = await updateQuestCommentHandler(
      payload({ body: 'Same body' }),
      MEMBER,
    )

    expect(writes()).toHaveLength(0)
    expect(item.editedAt).toBeNull()
    expect(item.body).toBe('Same body')
  })
})

describe('updateQuestCommentHandler — reverificación bloqueada', () => {
  it('bloquea quest → membresías → comentario, en ese orden', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt()
    enqueueUpdate([commentRow({ body: 'Edited body' })])

    await updateQuestCommentHandler(payload(), MEMBER)

    const calls = getDbCalls()
    // [0] quest, [1] comentario y [2] autor: comprobación previa, sin bloqueo.
    expect(calls[0]).toMatchObject({ table: quests, locked: false })
    expect(calls[1]).toMatchObject({ table: guildQuestComments, locked: false })
    expect(calls[2]).toMatchObject({ table: user, locked: false })
    // [3] quest bloqueada → membresías → [4] comentario bloqueado.
    expect(calls[3]).toMatchObject({ table: quests, locked: true })
    expect(callsBeforeMembershipLock).toBe(4)
    expect(calls[4]).toMatchObject({ table: guildQuestComments, locked: true })
    // Ningún SELECT a `user` después del primer bloqueo.
    const firstLock = calls.findIndex((call) => call.locked)
    expect(calls.slice(firstLock).some((call) => call.table === user)).toBe(
      false,
    )
    expect(resolveLockedGuildQuestAuth).toHaveBeenCalledWith(
      expect.anything(),
      GUILD,
      MEMBER,
    )
  })

  it('lanza Conflict si la quest se borró antes del bloqueo', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueSelect([])

    await expect(updateQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      EDIT_CONFLICT,
    )
  })

  it('lanza Conflict si el comentario se borró entre medias', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt(null)

    await expect(updateQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Conflict: the comment was deleted — please refresh and try again',
    )
    expect(writes()).toHaveLength(0)
  })

  it('lanza Conflict si el comentario quedó huérfano entre medias', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt({ authorId: null })

    await expect(updateQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Conflict: your permissions on this comment changed — please refresh and try again',
    )
    expect(writes()).toHaveLength(0)
  })
})

describe('updateQuestCommentHandler — reintento por deadlock', () => {
  it('repite la transacción una vez y la segunda pasada gana', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt()
    enqueueError('update', deadlockError())
    enqueueAttempt()
    enqueueUpdate([commentRow({ body: 'Edited body' })])

    const item = await updateQuestCommentHandler(payload(), MEMBER)

    expect(item.body).toBe('Edited body')
    expect(
      getDbCalls().filter((call) => call.table === quests && call.locked),
    ).toHaveLength(2)
  })

  it('con el deadlock persistente devuelve el Conflict genérico', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt()
    enqueueError('update', deadlockError())
    enqueueAttempt()
    enqueueError('update', deadlockError())

    await expect(updateQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      EDIT_CONFLICT,
    )
  })
})
