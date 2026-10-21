// @vitest-environment node
// Tests de borrar un comentario sin el RPC de TanStack Start: se prueba
// `deleteQuestCommentHandler` directamente, con `#/db` mockeado por el stub y
// los resolvers de auth de guild mockeados. Cubre los gates, quién borra (autor
// o Guild Master, huérfanos incluidos), la reverificación bloqueada en el orden
// quests → guild_members → comentario, el alcance del DELETE y el reintento
// por deadlock.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import type { GuildRole } from '#/db/schema'
import { guildQuestComments, quests } from '#/db/schema'
import {
  enqueueDelete,
  enqueueError,
  enqueueSelect,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import { deleteQuestCommentHandler } from './delete-quest-comment.handler'

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
const NEW_GM = 'u-new-gm'
const ADMIN = 'u-admin'
const MEMBER = 'u-member'
const OTHER = 'u-other'

const DELETE_CONFLICT =
  'Conflict: the comment changed while deleting — please refresh and try again'

const dialect = new PgDialect()

function payload() {
  return { questId: QUEST, commentId: COMMENT }
}

function authContext(
  viewerId: string,
  viewerRole: GuildRole = 'member',
  ownerId = GM,
) {
  return {
    viewer: { viewerId, viewerRole, ownerId },
    roleByUserId: new Map([[viewerId, viewerRole]]),
  }
}

function commentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT,
    authorId: MEMBER,
    body: 'A comment',
    createdAt: new Date('2026-07-20T10:00:00.123Z'),
    editedAt: null,
    ...overrides,
  }
}

let callsBeforeMembershipLock = -1

function setupPreCheck(opts: {
  viewerId: string
  viewerRole?: GuildRole
  comment?: Record<string, unknown> | null
  // Contexto de la relectura bloqueada, si difiere del de la comprobación previa
  lockedOwnerId?: string
}) {
  enqueueSelect([{ guildId: GUILD }])
  vi.mocked(resolveGuildQuestAuth).mockResolvedValue(
    authContext(opts.viewerId, opts.viewerRole),
  )
  enqueueSelect(opts.comment === null ? [] : [commentRow(opts.comment)])
  vi.mocked(resolveLockedGuildQuestAuth).mockImplementation(async () => {
    callsBeforeMembershipLock = getDbCalls().length
    return authContext(opts.viewerId, opts.viewerRole, opts.lockedOwnerId)
  })
}

// Un intento de la transacción: quest bloqueada y comentario bloqueado.
function enqueueAttempt(lockedComment: Record<string, unknown> | null = {}) {
  enqueueSelect([{ guildId: GUILD }])
  enqueueSelect(lockedComment === null ? [] : [commentRow(lockedComment)])
}

function deletes() {
  return getDbCalls().filter((call) => call.op === 'delete')
}

function deadlockError() {
  return new Error('Failed query: delete from "guild_quest_comments"', {
    cause: Object.assign(new Error('deadlock detected'), { code: '40P01' }),
  })
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
  callsBeforeMembershipLock = -1
})

describe('deleteQuestCommentHandler — gates', () => {
  it('lanza Not Found si la quest no existe', async () => {
    enqueueSelect([])

    await expect(deleteQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Not Found: quest not found',
    )
  })

  it('lanza Not Found para una quest personal', async () => {
    enqueueSelect([{ guildId: null }])

    await expect(deleteQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Not Found: quest not found',
    )
  })

  it('lanza Forbidden si el observador no es miembro del guild', async () => {
    enqueueSelect([{ guildId: GUILD }])
    vi.mocked(resolveGuildQuestAuth).mockRejectedValue(
      new Error('Forbidden: you are not a member of this guild'),
    )

    await expect(deleteQuestCommentHandler(payload(), OTHER)).rejects.toThrow(
      'Forbidden: you are not a member of this guild',
    )
    expect(deletes()).toHaveLength(0)
  })

  it('lanza Not Found si el comentario no existe en esa quest', async () => {
    setupPreCheck({ viewerId: MEMBER, comment: null })

    await expect(deleteQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Not Found: comment not found',
    )
  })
})

describe('deleteQuestCommentHandler — quién borra', () => {
  it('el autor borra su comentario, con un DELETE acotado por comentario y quest', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt()
    enqueueDelete([{ id: COMMENT }])

    await expect(deleteQuestCommentHandler(payload(), MEMBER)).resolves.toEqual(
      {
        id: COMMENT,
        questId: QUEST,
      },
    )

    const [write] = deletes()
    expect(write.table).toBe(guildQuestComments)
    const where = dialect.sqlToQuery(write.where as SQL)
    expect(where.sql).toBe(
      '("guild_quest_comments"."id" = $1 and "guild_quest_comments"."quest_id" = $2)',
    )
    expect(where.params).toEqual([COMMENT, QUEST])
  })

  it('el Guild Master borra comentarios ajenos', async () => {
    setupPreCheck({ viewerId: GM, viewerRole: 'owner' })
    enqueueAttempt()
    enqueueDelete([{ id: COMMENT }])

    await expect(
      deleteQuestCommentHandler(payload(), GM),
    ).resolves.toMatchObject({ id: COMMENT })
  })

  it('un Officer NO borra comentarios ajenos (Forbidden)', async () => {
    setupPreCheck({ viewerId: ADMIN, viewerRole: 'admin' })

    await expect(deleteQuestCommentHandler(payload(), ADMIN)).rejects.toThrow(
      'Forbidden: you can only delete your own comments',
    )
    expect(deletes()).toHaveLength(0)
  })

  it('otro miembro no borra el comentario (Forbidden)', async () => {
    setupPreCheck({ viewerId: OTHER })

    await expect(deleteQuestCommentHandler(payload(), OTHER)).rejects.toThrow(
      'Forbidden: you can only delete your own comments',
    )
  })

  it('un huérfano solo lo borra el Guild Master', async () => {
    setupPreCheck({ viewerId: MEMBER, comment: { authorId: null } })
    await expect(deleteQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Forbidden: you can only delete your own comments',
    )

    resetDbStub()
    vi.clearAllMocks()

    setupPreCheck({
      viewerId: GM,
      viewerRole: 'owner',
      comment: { authorId: null },
    })
    enqueueAttempt({ authorId: null })
    enqueueDelete([{ id: COMMENT }])
    await expect(
      deleteQuestCommentHandler(payload(), GM),
    ).resolves.toMatchObject({ id: COMMENT })
  })
})

describe('deleteQuestCommentHandler — reverificación bloqueada', () => {
  it('bloquea quest → membresías → comentario, en ese orden', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt()
    enqueueDelete([{ id: COMMENT }])

    await deleteQuestCommentHandler(payload(), MEMBER)

    const calls = getDbCalls()
    expect(calls[2]).toMatchObject({ table: quests, locked: true })
    expect(callsBeforeMembershipLock).toBe(3)
    expect(calls[3]).toMatchObject({ table: guildQuestComments, locked: true })
    expect(calls[4]).toMatchObject({ op: 'delete', returning: true })
    expect(resolveLockedGuildQuestAuth).toHaveBeenCalledWith(
      expect.anything(),
      GUILD,
      MEMBER,
    )
  })

  it('lanza Conflict si otro borrado ganó la carrera', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt(null)

    await expect(deleteQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      'Conflict: the comment was already deleted — please refresh and try again',
    )
    expect(deletes()).toHaveLength(0)
  })

  it('lanza Conflict si el Guild Master transfirió la propiedad entre medias', async () => {
    // La comprobación previa lo ve como owner; la relectura bloqueada, no.
    setupPreCheck({ viewerId: GM, viewerRole: 'owner', lockedOwnerId: NEW_GM })
    enqueueAttempt()

    await expect(deleteQuestCommentHandler(payload(), GM)).rejects.toThrow(
      'Conflict: your permissions on this comment changed — please refresh and try again',
    )
    expect(deletes()).toHaveLength(0)
  })

  it('lanza el Conflict genérico si el DELETE no afecta ninguna fila', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt()
    enqueueDelete([])

    await expect(deleteQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      DELETE_CONFLICT,
    )
  })
})

describe('deleteQuestCommentHandler — reintento por deadlock', () => {
  it('repite la transacción una vez y la segunda pasada gana', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt()
    enqueueError('delete', deadlockError())
    enqueueAttempt()
    enqueueDelete([{ id: COMMENT }])

    await expect(
      deleteQuestCommentHandler(payload(), MEMBER),
    ).resolves.toMatchObject({ id: COMMENT })
    expect(resolveLockedGuildQuestAuth).toHaveBeenCalledTimes(2)
  })

  it('con el deadlock persistente devuelve el Conflict genérico', async () => {
    setupPreCheck({ viewerId: MEMBER })
    enqueueAttempt()
    enqueueError('delete', deadlockError())
    enqueueAttempt()
    enqueueError('delete', deadlockError())

    await expect(deleteQuestCommentHandler(payload(), MEMBER)).rejects.toThrow(
      DELETE_CONFLICT,
    )
  })
})
