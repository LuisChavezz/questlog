// @vitest-environment node
// Tests de la lógica de updateQuest sin el RPC de TanStack Start: se prueba
// `updateQuestHandler` directamente, con `#/db` mockeado por el stub encadenable
// y los resolvers de auth de guild mockeados (su acceso a BD se testea aparte).
// Cubre el gate Not-Found, el modelo personal y TODO el modelo de dos ejes de
// guild (Axis 1 gestión completa vs. Axis 2 solo-estado).
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GuildRole, QuestStatus } from '#/db/schema'
import { guildQuestActivityLog } from '#/db/schema'
import {
  enqueueSelect,
  enqueueUpdate,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import type { UpdateQuestValues } from '../schemas/quest-schemas'
import { updateQuestHandler } from './update-quest.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('#/features/guilds/api/resolve-guild-quest-auth', () => ({
  resolveGuildQuestAuth: vi.fn(),
  resolveLockedGuildQuestAuth: vi.fn(),
}))

const USER = 'user-1'
const GUILD = 'guild-1'
const GM = 'gm-user' // Guild Master (dueño estructural del guild)

function payload(
  overrides: Partial<UpdateQuestValues> = {},
): UpdateQuestValues {
  return { id: 'quest-1', title: 'New title', ...overrides }
}

function personalRow(ownerId: string) {
  return { ownerId, guildId: null, assigneeId: null, supervisorId: null }
}

// Fija el contexto de auth de guild (viewer + roles) que devolverán ambos
// resolvers (pre-check y bloqueado), y encola la(s) lectura(s) de la quest.
function setupGuildQuest(opts: {
  data: UpdateQuestValues
  viewerId: string
  viewerRole: GuildRole
  creatorId: string
  creatorRole: GuildRole
  assigneeId?: string | null
  supervisorId?: string | null
  // Valores PRE-update de los campos rastreados, para las aserciones de la
  // bitácora (old/new y no-ops). La lectura bloqueada ahora también los lee.
  currentStatus?: QuestStatus
  currentDueDate?: Date | null
  // Miembros extra del guild (rol `member`), para que un cambio de asignado/
  // supervisor pase la validación de pertenencia.
  memberIds?: string[]
  expectAllow: boolean
}) {
  const questRow = {
    ownerId: opts.creatorId,
    guildId: GUILD,
    assigneeId: opts.assigneeId ?? null,
    supervisorId: opts.supervisorId ?? null,
    status: opts.currentStatus ?? 'backlog',
    dueDate: opts.currentDueDate ?? null,
  }
  const ctx = {
    viewer: {
      viewerId: opts.viewerId,
      viewerRole: opts.viewerRole,
      ownerId: GM,
    },
    roleByUserId: new Map<string, GuildRole>([
      [opts.creatorId, opts.creatorRole],
      ...(opts.memberIds ?? []).map((id) => [id, 'member'] as const),
    ]),
  }
  vi.mocked(resolveGuildQuestAuth).mockResolvedValue(ctx)
  vi.mocked(resolveLockedGuildQuestAuth).mockResolvedValue(ctx)

  enqueueSelect([questRow]) // lectura previa (sin filtro de owner)
  if (opts.expectAllow) {
    enqueueSelect([questRow]) // lectura bloqueada dentro de la transacción
    enqueueUpdate([{ ...opts.data }]) // escritura devuelve la fila
  }

  return updateQuestHandler(opts.data, opts.viewerId)
}

// Filas escritas en la bitácora de auditoría (inserts contra su tabla).
function activityLogInserts() {
  return getDbCalls().filter(
    (call) => call.op === 'insert' && call.table === guildQuestActivityLog,
  )
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('updateQuestHandler — gate y quest personal', () => {
  it('lanza Not Found cuando la quest no existe (para cualquier campo)', async () => {
    enqueueSelect([])
    await expect(updateQuestHandler(payload(), USER)).rejects.toThrow(
      'Not Found: quest not found',
    )
  })

  it('lanza Forbidden cuando un usuario edita una quest personal ajena', async () => {
    enqueueSelect([personalRow('someone-else')])
    await expect(updateQuestHandler(payload(), USER)).rejects.toThrow(
      'Forbidden: you do not have permission to modify this quest',
    )
  })

  it('actualiza y devuelve la quest cuando el dueño edita su quest personal', async () => {
    const updated = {
      id: 'quest-1',
      ownerId: USER,
      guildId: null,
      title: 'New title',
    }
    enqueueSelect([personalRow(USER)])
    enqueueSelect([personalRow(USER)])
    enqueueUpdate([updated])

    await expect(updateQuestHandler(payload(), USER)).resolves.toEqual(updated)
  })

  it('actualizar una quest personal NO escribe ninguna fila en la bitácora', async () => {
    // Ni siquiera un cambio de status —campo que SÍ se auditaría en un guild—
    // debe registrarse para una quest personal (guildId NULL).
    enqueueSelect([personalRow(USER)])
    enqueueSelect([personalRow(USER)])
    enqueueUpdate([{ id: 'quest-1', ownerId: USER, guildId: null }])

    await updateQuestHandler(payload({ title: undefined, status: 'done' }), USER)

    expect(activityLogInserts()).toHaveLength(0)
  })
})

describe('updateQuestHandler — modelo de dos ejes de guild', () => {
  // ─── Eje 1: gestión completa ──────────────────────────────────────────────
  it('el creador puede gestionar su propia quest', async () => {
    await expect(
      setupGuildQuest({
        data: payload(),
        viewerId: 'u-creator',
        viewerRole: 'member',
        creatorId: 'u-creator',
        creatorRole: 'member',
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('el Guild Master puede gestionar cualquier quest', async () => {
    await expect(
      setupGuildQuest({
        data: payload(),
        viewerId: GM,
        viewerRole: 'owner',
        creatorId: 'u-officer',
        creatorRole: 'admin',
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('un Officer puede gestionar la quest de un Member', async () => {
    await expect(
      setupGuildQuest({
        data: payload(),
        viewerId: 'u-officer',
        viewerRole: 'admin',
        creatorId: 'u-member',
        creatorRole: 'member',
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('un Officer NO puede gestionar la quest de otro Officer', async () => {
    await expect(
      setupGuildQuest({
        data: payload(),
        viewerId: 'u-officer',
        viewerRole: 'admin',
        creatorId: 'u-officer-2',
        creatorRole: 'admin',
        expectAllow: false,
      }),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to modify this quest',
    )
  })

  it('un Officer NO puede gestionar la quest del Guild Master', async () => {
    await expect(
      setupGuildQuest({
        data: payload(),
        viewerId: 'u-officer',
        viewerRole: 'admin',
        creatorId: GM,
        creatorRole: 'owner',
        expectAllow: false,
      }),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to modify this quest',
    )
  })

  it('un Member ajeno no puede gestionar la quest de otro', async () => {
    await expect(
      setupGuildQuest({
        data: payload(),
        viewerId: 'u-member',
        viewerRole: 'member',
        creatorId: 'u-other',
        creatorRole: 'member',
        expectAllow: false,
      }),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to modify this quest',
    )
  })

  // ─── Eje 2: solo estado (asignado / supervisor) ───────────────────────────
  it('el asignado puede cambiar SOLO el estado (Axis 2)', async () => {
    await expect(
      setupGuildQuest({
        data: payload({ title: undefined, status: 'done' }),
        viewerId: 'u-assignee',
        viewerRole: 'member',
        creatorId: 'u-other',
        creatorRole: 'member',
        assigneeId: 'u-assignee',
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('el asignado NO puede cambiar un campo de gestión (frontera Axis 2)', async () => {
    await expect(
      setupGuildQuest({
        data: payload({ title: 'Renamed' }),
        viewerId: 'u-assignee',
        viewerRole: 'member',
        creatorId: 'u-other',
        creatorRole: 'member',
        assigneeId: 'u-assignee',
        expectAllow: false,
      }),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to modify this quest',
    )
  })

  it('el supervisor puede cambiar SOLO el estado (Axis 2)', async () => {
    await expect(
      setupGuildQuest({
        data: payload({ title: undefined, status: 'in_progress' }),
        viewerId: 'u-supervisor',
        viewerRole: 'member',
        creatorId: 'u-other',
        creatorRole: 'member',
        supervisorId: 'u-supervisor',
        expectAllow: true,
      }),
    ).resolves.toBeDefined()
  })

  it('el supervisor NO puede cambiar un campo de gestión (frontera Axis 2)', async () => {
    await expect(
      setupGuildQuest({
        data: payload({ title: 'Renamed' }),
        viewerId: 'u-supervisor',
        viewerRole: 'member',
        creatorId: 'u-other',
        creatorRole: 'member',
        supervisorId: 'u-supervisor',
        expectAllow: false,
      }),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to modify this quest',
    )
  })

  it('un Member sin relación con la quest no puede ni cambiar el estado', async () => {
    await expect(
      setupGuildQuest({
        data: payload({ title: undefined, status: 'done' }),
        viewerId: 'u-stranger',
        viewerRole: 'member',
        creatorId: 'u-other',
        creatorRole: 'member',
        expectAllow: false,
      }),
    ).rejects.toThrow('Forbidden: you can only update the status of this quest')
  })
})

describe('updateQuestHandler — bitácora de auditoría de guild', () => {
  it('cambiar el status escribe exactamente una fila `field_updated` con old/new', async () => {
    await setupGuildQuest({
      data: payload({ title: undefined, status: 'done' }),
      viewerId: 'u-creator',
      viewerRole: 'member',
      creatorId: 'u-creator',
      creatorRole: 'member',
      currentStatus: 'backlog',
      expectAllow: true,
    })

    const inserts = activityLogInserts()
    expect(inserts).toHaveLength(1)
    expect(inserts[0].values).toEqual([
      {
        questId: 'quest-1',
        guildId: GUILD,
        actorId: 'u-creator',
        eventType: 'field_updated',
        field: 'status',
        oldValue: 'backlog',
        newValue: 'done',
      },
    ])
  })

  it('cambiar varios campos rastreados en una llamada escribe una fila por campo', async () => {
    // status (backlog→done) y dueDate (null→2026-08-01) en el mismo update.
    await setupGuildQuest({
      data: payload({ title: undefined, status: 'done', dueDate: '2026-08-01' }),
      viewerId: 'u-creator',
      viewerRole: 'member',
      creatorId: 'u-creator',
      creatorRole: 'member',
      currentStatus: 'backlog',
      currentDueDate: null,
      expectAllow: true,
    })

    const inserts = activityLogInserts()
    expect(inserts).toHaveLength(1)
    const rows = inserts[0].values as Array<Record<string, unknown>>
    expect(rows.map((row) => row.field)).toEqual(['status', 'dueDate'])
    expect(rows[1]).toEqual({
      questId: 'quest-1',
      guildId: GUILD,
      actorId: 'u-creator',
      eventType: 'field_updated',
      field: 'dueDate',
      oldValue: null,
      newValue: '2026-08-01T00:00:00.000Z',
    })
  })

  it('cambiar el asignado escribe una fila `field_updated` de assigneeId', async () => {
    await setupGuildQuest({
      data: payload({ title: undefined, assigneeId: 'u-assignee' }),
      viewerId: 'u-creator',
      viewerRole: 'member',
      creatorId: 'u-creator',
      creatorRole: 'member',
      assigneeId: null,
      memberIds: ['u-assignee'],
      expectAllow: true,
    })

    const inserts = activityLogInserts()
    expect(inserts).toHaveLength(1)
    expect(inserts[0].values).toEqual([
      {
        questId: 'quest-1',
        guildId: GUILD,
        actorId: 'u-creator',
        eventType: 'field_updated',
        field: 'assigneeId',
        oldValue: null,
        newValue: 'u-assignee',
      },
    ])
  })

  it('re-enviar el mismo status no escribe ninguna fila (no-op)', async () => {
    await setupGuildQuest({
      data: payload({ title: undefined, status: 'todo' }),
      viewerId: 'u-creator',
      viewerRole: 'member',
      creatorId: 'u-creator',
      creatorRole: 'member',
      currentStatus: 'todo',
      expectAllow: true,
    })

    expect(activityLogInserts()).toHaveLength(0)
  })

  it('re-enviar la misma dueDate no escribe ninguna fila (no-op de fecha)', async () => {
    // Mismo día de calendario: el string del payload parsea al MISMO Date
    // UTC-medianoche que ya está guardado, así que no hay cambio real.
    await setupGuildQuest({
      data: payload({ title: undefined, dueDate: '2026-08-01' }),
      viewerId: 'u-creator',
      viewerRole: 'member',
      creatorId: 'u-creator',
      creatorRole: 'member',
      currentDueDate: new Date(Date.UTC(2026, 7, 1)),
      expectAllow: true,
    })

    expect(activityLogInserts()).toHaveLength(0)
  })

  it('cambiar solo un campo NO rastreado (priority) no escribe ninguna fila', async () => {
    await setupGuildQuest({
      data: payload({ title: undefined, priority: 'high' }),
      viewerId: 'u-creator',
      viewerRole: 'member',
      creatorId: 'u-creator',
      creatorRole: 'member',
      expectAllow: true,
    })

    expect(activityLogInserts()).toHaveLength(0)
  })
})
