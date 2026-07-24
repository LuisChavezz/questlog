// @vitest-environment node
// Tests de la lógica de createQuest: creación personal (insert directo) y de
// guild (solo Guild Master/Officer, con checks de membresía de asignado y
// supervisor). `#/db` mockeado por el stub; los resolvers de auth mockeados.
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GuildRole } from '#/db/schema'
import { guildQuestActivityLog } from '#/db/schema'
import { enqueueInsert, getDbCalls, resetDbStub } from '#/test/drizzle-stub'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import type { CreateQuestValues } from '../schemas/quest-schemas'
import { createQuestHandler } from './create-quest.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('#/features/guilds/api/resolve-guild-quest-auth', () => ({
  resolveGuildQuestAuth: vi.fn(),
  resolveLockedGuildQuestAuth: vi.fn(),
}))

const GUILD = 'guild-1'
const GM = 'gm-user'

function createData(
  overrides: Partial<CreateQuestValues> = {},
): CreateQuestValues {
  return { title: 'Quest', priority: 'medium', ...overrides }
}

// Fija el contexto de auth de guild (viewer + miembros) y encola el insert si se
// espera que la creación proceda.
function setupGuildCreate(opts: {
  data: CreateQuestValues
  viewerId: string
  viewerRole: GuildRole
  memberIds?: string[]
  expectAllow: boolean
}) {
  const roleByUserId = new Map<string, GuildRole>(
    (opts.memberIds ?? []).map((id) => [id, 'member']),
  )
  const ctx = {
    viewer: {
      viewerId: opts.viewerId,
      viewerRole: opts.viewerRole,
      ownerId: GM,
    },
    roleByUserId,
  }
  vi.mocked(resolveGuildQuestAuth).mockResolvedValue(ctx)
  vi.mocked(resolveLockedGuildQuestAuth).mockResolvedValue(ctx)

  if (opts.expectAllow) {
    enqueueInsert([{ id: 'new-quest', ...opts.data }])
  }

  return createQuestHandler(opts.data, opts.viewerId)
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

// Filas escritas en la bitácora de auditoría (inserts contra su tabla).
function activityLogInserts() {
  return getDbCalls().filter(
    (call) => call.op === 'insert' && call.table === guildQuestActivityLog,
  )
}

describe('createQuestHandler — quest personal', () => {
  it('crea e inserta una quest personal', async () => {
    const inserted = { id: 'new-quest', title: 'Quest', guildId: null }
    enqueueInsert([inserted])

    await expect(createQuestHandler(createData(), 'user-1')).resolves.toEqual(
      inserted,
    )
  })

  it('una quest personal NO escribe ninguna fila en la bitácora', async () => {
    enqueueInsert([{ id: 'new-quest', title: 'Quest', guildId: null }])

    await createQuestHandler(createData(), 'user-1')

    expect(activityLogInserts()).toHaveLength(0)
  })
})

describe('createQuestHandler — quest de guild', () => {
  it('el Guild Master puede crear una quest de guild', async () => {
    await expect(
      setupGuildCreate({
        data: createData({ guildId: GUILD }),
        viewerId: GM,
        viewerRole: 'owner',
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('un Officer puede crear una quest de guild', async () => {
    await expect(
      setupGuildCreate({
        data: createData({ guildId: GUILD }),
        viewerId: 'u-officer',
        viewerRole: 'admin',
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('un Member NO puede crear una quest de guild', async () => {
    await expect(
      setupGuildCreate({
        data: createData({ guildId: GUILD }),
        viewerId: 'u-member',
        viewerRole: 'member',
        expectAllow: false,
      }),
    ).rejects.toThrow(
      'Forbidden: only the Guild Master or an Officer can create guild quests',
    )
  })

  it('rechaza un asignado que no es miembro del guild', async () => {
    await expect(
      setupGuildCreate({
        data: createData({ guildId: GUILD, assigneeId: 'u-outsider' }),
        viewerId: 'u-officer',
        viewerRole: 'admin',
        memberIds: [], // el asignado no está en el guild
        expectAllow: false,
      }),
    ).rejects.toThrow('Assignee must be a member of the guild')
  })

  it('rechaza un supervisor que no es miembro del guild', async () => {
    await expect(
      setupGuildCreate({
        data: createData({ guildId: GUILD, supervisorId: 'u-outsider' }),
        viewerId: 'u-officer',
        viewerRole: 'admin',
        memberIds: [],
        expectAllow: false,
      }),
    ).rejects.toThrow('Supervisor must be a member of the guild')
  })

  it('acepta un asignado que sí es miembro del guild', async () => {
    await expect(
      setupGuildCreate({
        data: createData({ guildId: GUILD, assigneeId: 'u-member' }),
        viewerId: 'u-officer',
        viewerRole: 'admin',
        memberIds: ['u-member'],
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('escribe exactamente una fila `created` con questId/guildId/actorId correctos', async () => {
    await setupGuildCreate({
      data: createData({ guildId: GUILD }),
      viewerId: GM,
      viewerRole: 'owner',
      expectAllow: true,
    })

    const inserts = activityLogInserts()
    expect(inserts).toHaveLength(1)
    // `id: 'new-quest'` es lo que devuelve el INSERT encolado por setupGuildCreate.
    expect(inserts[0].values).toEqual({
      questId: 'new-quest',
      guildId: GUILD,
      actorId: GM,
      eventType: 'created',
    })
  })
})
