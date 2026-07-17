// @vitest-environment node
// Tests de la lógica de deleteQuests (borrado múltiple). Punto clave: fail-closed
// — si UNA sola quest del lote no es gestionable, se aborta todo y no se borra
// ninguna. `#/db` mockeado por el stub; los resolvers de auth mockeados.
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GuildRole } from '#/db/schema'
import { enqueueDelete, enqueueSelect, resetDbStub } from '#/test/drizzle-stub'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import { deleteQuestsHandler } from './delete-quests.handler'

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

function personalQuest(id: string, ownerId: string) {
  return { id, ownerId, guildId: null, assigneeId: null, supervisorId: null }
}

function guildQuest(id: string, ownerId: string) {
  return { id, ownerId, guildId: GUILD, assigneeId: null, supervisorId: null }
}

function guildCtx(
  viewerRole: GuildRole,
  creatorRoles: Record<string, GuildRole>,
) {
  return {
    viewer: { viewerId: 'u-officer', viewerRole, ownerId: GM },
    roleByUserId: new Map<string, GuildRole>(Object.entries(creatorRoles)),
  }
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('deleteQuestsHandler — lote personal', () => {
  it('devuelve [] cuando ninguna de las seleccionadas existe', async () => {
    enqueueSelect([])
    await expect(
      deleteQuestsHandler({ ids: ['q1', 'q2'] }, USER),
    ).resolves.toEqual([])
  })

  it('borra todas cuando el usuario es dueño de todas', async () => {
    const rows = [personalQuest('q1', USER), personalQuest('q2', USER)]
    enqueueSelect(rows) // lectura previa
    enqueueSelect(rows) // lectura bloqueada
    enqueueDelete(rows) // el borrado devuelve las dos filas

    const result = await deleteQuestsHandler({ ids: ['q1', 'q2'] }, USER)
    expect(result).toHaveLength(2)
  })

  it('fail-closed: si una del lote es ajena, no borra ninguna', async () => {
    // q1 es del usuario, q2 es de otro — el lote entero se rechaza en el
    // pre-check, sin llegar a la transacción de borrado.
    enqueueSelect([
      personalQuest('q1', USER),
      personalQuest('q2', 'someone-else'),
    ])

    await expect(
      deleteQuestsHandler({ ids: ['q1', 'q2'] }, USER),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to delete one or more of the selected quests',
    )
  })
})

describe('deleteQuestsHandler — lote de guild', () => {
  it('un Officer borra un lote de quests de Members', async () => {
    const rows = [guildQuest('q1', 'u-m1'), guildQuest('q2', 'u-m2')]
    const ctx = guildCtx('admin', { 'u-m1': 'member', 'u-m2': 'member' })
    vi.mocked(resolveGuildQuestAuth).mockResolvedValue(ctx)
    vi.mocked(resolveLockedGuildQuestAuth).mockResolvedValue(ctx)

    enqueueSelect(rows)
    enqueueSelect(rows)
    enqueueDelete(rows)

    const result = await deleteQuestsHandler({ ids: ['q1', 'q2'] }, 'u-officer')
    expect(result).toHaveLength(2)
  })

  it('fail-closed: un Officer no puede borrar un lote que incluye la quest de otro Officer', async () => {
    const rows = [guildQuest('q1', 'u-m1'), guildQuest('q2', 'u-officer-2')]
    const ctx = guildCtx('admin', {
      'u-m1': 'member',
      'u-officer-2': 'admin',
    })
    vi.mocked(resolveGuildQuestAuth).mockResolvedValue(ctx)
    vi.mocked(resolveLockedGuildQuestAuth).mockResolvedValue(ctx)

    // Solo la lectura previa: el pre-check rechaza antes de la transacción.
    enqueueSelect(rows)

    await expect(
      deleteQuestsHandler({ ids: ['q1', 'q2'] }, 'u-officer'),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to delete one or more of the selected quests',
    )
  })
})
