// @vitest-environment node
// Tests de la lógica de deleteQuest: borrar es gestión completa (eje 1). Cubre el
// no-op para una quest inexistente, el modelo personal y el de guild. `#/db`
// mockeado por el stub; los resolvers de auth mockeados.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTableConfig } from 'drizzle-orm/pg-core'

import type { GuildRole } from '#/db/schema'
import { guildQuestActivityLog, quests } from '#/db/schema'
import {
  enqueueDelete,
  enqueueSelect,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import { deleteQuestHandler } from './delete-quest.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('#/features/guilds/api/resolve-guild-quest-auth', () => ({
  resolveGuildQuestAuth: vi.fn(),
  resolveLockedGuildQuestAuth: vi.fn(),
}))

const USER = 'user-1'
const GUILD = 'guild-1'
const GM = 'gm-user'

function personalRow(ownerId: string) {
  return { ownerId, guildId: null, assigneeId: null, supervisorId: null }
}

// Fija el contexto de auth de guild y encola las lecturas/borrado de la quest.
function setupGuildDelete(opts: {
  viewerId: string
  viewerRole: GuildRole
  creatorId: string
  creatorRole: GuildRole
  expectAllow: boolean
}) {
  const questRow = {
    ownerId: opts.creatorId,
    guildId: GUILD,
    assigneeId: null,
    supervisorId: null,
  }
  const ctx = {
    viewer: {
      viewerId: opts.viewerId,
      viewerRole: opts.viewerRole,
      ownerId: GM,
    },
    roleByUserId: new Map<string, GuildRole>([
      [opts.creatorId, opts.creatorRole],
    ]),
  }
  vi.mocked(resolveGuildQuestAuth).mockResolvedValue(ctx)
  vi.mocked(resolveLockedGuildQuestAuth).mockResolvedValue(ctx)

  enqueueSelect([questRow]) // lectura previa
  if (opts.expectAllow) {
    enqueueSelect([questRow]) // lectura bloqueada
    enqueueDelete([{ id: 'quest-1' }]) // borrado devuelve la fila
  }

  return deleteQuestHandler({ id: 'quest-1' }, opts.viewerId)
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('deleteQuestHandler — quest personal', () => {
  it('devuelve undefined (no-op) si la quest no existe', async () => {
    enqueueSelect([])
    await expect(
      deleteQuestHandler({ id: 'quest-1' }, USER),
    ).resolves.toBeUndefined()
  })

  it('borra la quest personal cuando la borra su dueño', async () => {
    enqueueSelect([personalRow(USER)])
    enqueueSelect([personalRow(USER)])
    enqueueDelete([{ id: 'quest-1' }])

    await expect(
      deleteQuestHandler({ id: 'quest-1' }, USER),
    ).resolves.toBeDefined()
  })

  it('rechaza borrar la quest personal de otro usuario', async () => {
    enqueueSelect([personalRow('someone-else')])
    await expect(deleteQuestHandler({ id: 'quest-1' }, USER)).rejects.toThrow(
      'Forbidden: you do not have permission to delete this quest',
    )
  })
})

describe('deleteQuestHandler — quest de guild (eje 1)', () => {
  it('un Officer puede borrar la quest de un Member', async () => {
    await expect(
      setupGuildDelete({
        viewerId: 'u-officer',
        viewerRole: 'admin',
        creatorId: 'u-member',
        creatorRole: 'member',
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('el Guild Master puede borrar cualquier quest', async () => {
    await expect(
      setupGuildDelete({
        viewerId: GM,
        viewerRole: 'owner',
        creatorId: 'u-officer',
        creatorRole: 'admin',
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('un Officer NO puede borrar la quest de otro Officer', async () => {
    await expect(
      setupGuildDelete({
        viewerId: 'u-officer',
        viewerRole: 'admin',
        creatorId: 'u-officer-2',
        creatorRole: 'admin',
        expectAllow: false,
      }),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to delete this quest',
    )
  })

  it('un Member ajeno no puede borrar la quest de otro', async () => {
    await expect(
      setupGuildDelete({
        viewerId: 'u-member',
        viewerRole: 'member',
        creatorId: 'u-other',
        creatorRole: 'member',
        expectAllow: false,
      }),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to delete this quest',
    )
  })
})

describe('deleteQuestHandler — bitácora de auditoría y cascada', () => {
  it('borrar una quest de guild no escribe en la bitácora y usa un DELETE estándar', async () => {
    await setupGuildDelete({
      viewerId: GM,
      viewerRole: 'owner',
      creatorId: 'u-member',
      creatorRole: 'member',
      expectAllow: true,
    })

    const calls = getDbCalls()
    // El borrado NO registra ningún evento (no hay evento de borrado).
    expect(
      calls.filter(
        (call) => call.op === 'insert' && call.table === guildQuestActivityLog,
      ),
    ).toHaveLength(0)
    // Es un DELETE de filas estándar sobre `quests` (no SQL crudo), así que el
    // FK ON DELETE CASCADE limpia las filas de bitácora del lado de la BD.
    expect(
      calls.some((call) => call.op === 'delete' && call.table === quests),
    ).toBe(true)
  })

  it('la FK `quest_id` de la bitácora está declarada ON DELETE CASCADE', () => {
    // Verificación estructural de la cascada que borra la historia junto con la
    // quest — la garantía real que sustituye a cualquier evento de borrado.
    const { foreignKeys } = getTableConfig(guildQuestActivityLog)
    const questFk = foreignKeys.find((fk) =>
      fk.reference().columns.some((col) => col.name === 'quest_id'),
    )
    expect(questFk?.onDelete).toBe('cascade')
  })
})
