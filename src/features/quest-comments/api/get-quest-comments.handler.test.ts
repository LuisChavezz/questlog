// @vitest-environment node
// Tests del lector paginado del hilo de comentarios. `#/db` mockeado por el
// stub y los resolvers de auth de guild mockeados (su acceso a BD se testea
// aparte): aquí se cubren los gates (Not Found / Forbidden), la forma de cada
// comentario (autor sin email, huérfanos, permisos por observador) y la
// paginación por clave (cursor + desempate por id en WHERE y ORDER BY).
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import type { GuildRole } from '#/db/schema'
import { guildQuestComments } from '#/db/schema'
import { enqueueSelect, getDbCalls, resetDbStub } from '#/test/drizzle-stub'
import { resolveGuildQuestAuth } from '#/features/guilds/api/resolve-guild-quest-auth'
import { getQuestCommentsHandler } from './get-quest-comments.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('#/features/guilds/api/resolve-guild-quest-auth', () => ({
  resolveGuildQuestAuth: vi.fn(),
  resolveLockedGuildQuestAuth: vi.fn(),
}))

const QUEST = '11111111-1111-4111-8111-111111111111'
const GUILD = 'guild-1'
const GM = 'u-gm' // Guild Master — dueño estructural (guilds.owner_id)
const MEMBER = 'u-member'
const OTHER = 'u-other'

const dialect = new PgDialect()
function toQuery(condition: unknown) {
  return dialect.sqlToQuery(condition as SQL)
}

// Fila cruda del SELECT (comentario ⋈ user), como la devuelve el stub.
function commentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-1',
    body: 'First!',
    createdAt: new Date('2026-07-20T10:00:00.123Z'),
    editedAt: null,
    authorId: MEMBER,
    authorName: 'Ada Lovelace',
    authorEmail: 'ada@example.com',
    authorImage: null,
    authorAvatarId: null,
    ...overrides,
  }
}

// Quest de guild encontrada + observador miembro con el rol dado.
function setupMember(viewerId: string, viewerRole: GuildRole = 'member') {
  enqueueSelect([{ guildId: GUILD }])
  vi.mocked(resolveGuildQuestAuth).mockResolvedValue({
    viewer: { viewerId, viewerRole, ownerId: GM },
    roleByUserId: new Map([[viewerId, viewerRole]]),
  })
}

// El SELECT del hilo (el segundo: el primero resuelve la quest).
function threadSelect() {
  const call = getDbCalls().find(
    (candidate) =>
      candidate.op === 'select' && candidate.table === guildQuestComments,
  )
  if (!call) throw new Error('No thread SELECT was issued')
  return call
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('getQuestCommentsHandler — gates', () => {
  it('lanza Not Found si la quest no existe, sin llegar a la membresía', async () => {
    enqueueSelect([])

    await expect(
      getQuestCommentsHandler({ questId: QUEST }, MEMBER),
    ).rejects.toThrow('Not Found: quest not found')
    expect(resolveGuildQuestAuth).not.toHaveBeenCalled()
  })

  it('lanza el MISMO Not Found para una quest personal (no revela que existe)', async () => {
    enqueueSelect([{ guildId: null }])

    await expect(
      getQuestCommentsHandler({ questId: QUEST }, MEMBER),
    ).rejects.toThrow('Not Found: quest not found')
    expect(resolveGuildQuestAuth).not.toHaveBeenCalled()
  })

  it('lanza Forbidden si el observador no es miembro del guild', async () => {
    enqueueSelect([{ guildId: GUILD }])
    vi.mocked(resolveGuildQuestAuth).mockRejectedValue(
      new Error('Forbidden: you are not a member of this guild'),
    )

    await expect(
      getQuestCommentsHandler({ questId: QUEST }, OTHER),
    ).rejects.toThrow('Forbidden: you are not a member of this guild')
    // No se llega a leer el hilo.
    expect(getDbCalls().some((call) => call.table === guildQuestComments)).toBe(
      false,
    )
  })

  it('resuelve la membresía sin relatedUserIds: solo se lee al observador', async () => {
    setupMember(MEMBER)
    enqueueSelect([])

    await getQuestCommentsHandler({ questId: QUEST }, MEMBER)

    expect(resolveGuildQuestAuth).toHaveBeenCalledWith(GUILD, MEMBER)
  })
})

describe('getQuestCommentsHandler — forma de cada comentario', () => {
  it('resuelve el autor a nombre/avatar/iniciales sin propagar el email', async () => {
    setupMember(MEMBER)
    enqueueSelect([commentRow()])

    const page = await getQuestCommentsHandler({ questId: QUEST }, MEMBER)

    expect(page.items[0]).toEqual({
      id: 'c-1',
      body: 'First!',
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
    expect(JSON.stringify(page)).not.toContain('ada@example.com')
  })

  it('un comentario huérfano (autor borrado) viaja con author null', async () => {
    setupMember(MEMBER)
    enqueueSelect([
      commentRow({
        authorId: null,
        authorName: null,
        authorEmail: null,
      }),
    ])

    const page = await getQuestCommentsHandler({ questId: QUEST }, MEMBER)

    expect(page.items[0].author).toBeNull()
    expect(page.items[0].canEdit).toBe(false)
    expect(page.items[0].canDelete).toBe(false)
  })

  it('evalúa canEdit/canDelete por comentario para un Member', async () => {
    setupMember(MEMBER)
    enqueueSelect([
      commentRow({ id: 'mine', authorId: MEMBER }),
      commentRow({ id: 'theirs', authorId: OTHER }),
    ])

    const page = await getQuestCommentsHandler({ questId: QUEST }, MEMBER)
    const flags = page.items.map(({ id, canEdit, canDelete }) => ({
      id,
      canEdit,
      canDelete,
    }))

    expect(flags).toEqual([
      { id: 'mine', canEdit: true, canDelete: true },
      { id: 'theirs', canEdit: false, canDelete: false },
    ])
  })

  it('el Guild Master borra (pero no edita) comentarios ajenos y huérfanos', async () => {
    setupMember(GM, 'owner')
    enqueueSelect([
      commentRow({ id: 'theirs', authorId: OTHER }),
      commentRow({ id: 'orphan', authorId: null }),
    ])

    const page = await getQuestCommentsHandler({ questId: QUEST }, GM)

    for (const item of page.items) {
      expect(item.canEdit).toBe(false)
      expect(item.canDelete).toBe(true)
    }
  })
})

describe('getQuestCommentsHandler — paginación por cursor', () => {
  it('ordena por created_at DESC con id DESC como desempate', async () => {
    setupMember(MEMBER)
    enqueueSelect([])

    await getQuestCommentsHandler({ questId: QUEST }, MEMBER)

    // Sin el desempate, dos comentarios con el mismo milisegundo quedarían en
    // orden indefinido y el cursor podría saltarse o repetir uno.
    expect(threadSelect().orderBy?.map((order) => toQuery(order).sql)).toEqual([
      '"guild_quest_comments"."created_at" desc',
      '"guild_quest_comments"."id" desc',
    ])
  })

  it('la primera página filtra solo por quest, sin condición de cursor', async () => {
    setupMember(MEMBER)
    enqueueSelect([])

    await getQuestCommentsHandler({ questId: QUEST }, MEMBER)

    const where = toQuery(threadSelect().where)
    expect(where.sql).toBe('"guild_quest_comments"."quest_id" = $1')
    expect(where.params).toEqual([QUEST])
  })

  it('con cursor compara la fila (created_at, id) contra él', async () => {
    setupMember(MEMBER)
    enqueueSelect([])
    const cursor = {
      createdAt: '2026-07-20T10:00:00.123Z',
      id: '22222222-2222-4222-8222-222222222222',
    }

    await getQuestCommentsHandler({ questId: QUEST, cursor }, MEMBER)

    const where = toQuery(threadSelect().where)
    expect(where.sql).toBe(
      '("guild_quest_comments"."quest_id" = $1 and ("guild_quest_comments"."created_at", "guild_quest_comments"."id") < ($2::timestamptz, $3::uuid))',
    )
    // La fecha viaja como el string ISO del cursor, sin reconstruir un Date.
    expect(where.params).toEqual([QUEST, cursor.createdAt, cursor.id])
  })

  it('sin filas de más: hasMore false y nextCursor null', async () => {
    setupMember(MEMBER)
    enqueueSelect(
      Array.from({ length: 20 }, (_, index) =>
        commentRow({ id: `c-${index}` }),
      ),
    )

    const page = await getQuestCommentsHandler({ questId: QUEST }, MEMBER)

    expect(page.items).toHaveLength(20)
    expect(page.hasMore).toBe(false)
    expect(page.nextCursor).toBeNull()
  })

  it('con 21 filas devuelve 20 y el cursor apunta al más antiguo de la página', async () => {
    setupMember(MEMBER)
    const rows = Array.from({ length: 21 }, (_, index) =>
      commentRow({
        id: `c-${index}`,
        createdAt: new Date(Date.UTC(2026, 6, 20, 10, 0, 0, 500 - index)),
      }),
    )
    enqueueSelect(rows)

    const page = await getQuestCommentsHandler({ questId: QUEST }, MEMBER)

    expect(page.items).toHaveLength(20)
    expect(page.items.at(-1)?.id).toBe('c-19')
    expect(page.hasMore).toBe(true)
    // ISO con milisegundos: la misma precisión que guarda la columna.
    expect(page.nextCursor).toEqual({
      createdAt: '2026-07-20T10:00:00.481Z',
      id: 'c-19',
    })
  })
})
