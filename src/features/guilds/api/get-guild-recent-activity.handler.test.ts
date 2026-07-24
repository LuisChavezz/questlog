// @vitest-environment node
// Tests de la lógica de la actividad reciente (top 5). `#/db` mockeado por el
// stub; `resolve-guild-or-throw` mockeado (su acceso a BD se testea aparte), así
// que aquí se cubre la orquestación: resolver guild → verificar membresía →
// consultar la bitácora, más los gates de Not Found / Forbidden.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { enqueueSelect, getDbCalls, resetDbStub } from '#/test/drizzle-stub'
import {
  assertGuildMembershipOrThrow,
  resolveGuildBySlugOrThrow,
} from './resolve-guild-or-throw'
import { getGuildRecentActivityHandler } from './get-guild-recent-activity.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('./resolve-guild-or-throw', () => ({
  resolveGuildBySlugOrThrow: vi.fn(),
  assertGuildMembershipOrThrow: vi.fn(),
}))

const SLUG = 'my-guild'
const GUILD = 'guild-1'
const USER = 'u-1'

// Fila cruda del JOIN (log ⋈ quest ⋈ user), como la devuelve el SELECT.
function joinRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    questId: 'quest-1',
    questTitle: 'Slay the dragon',
    eventType: 'created',
    field: null,
    oldValue: null,
    newValue: null,
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    actorId: USER,
    actorName: 'Ada Lovelace',
    actorEmail: 'ada@example.com',
    actorImage: null,
    actorAvatarId: null,
    ...overrides,
  }
}

function setupMember() {
  vi.mocked(resolveGuildBySlugOrThrow).mockResolvedValue({
    id: GUILD,
    ownerId: 'u-owner',
  })
  vi.mocked(assertGuildMembershipOrThrow).mockResolvedValue({ role: 'member' })
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('getGuildRecentActivityHandler', () => {
  it('resuelve el guild, verifica membresía y devuelve las entradas de la bitácora', async () => {
    setupMember()
    enqueueSelect([joinRow({ id: 'log-a' }), joinRow({ id: 'log-b' })])

    const result = await getGuildRecentActivityHandler(SLUG, USER)

    expect(result.map((entry) => entry.id)).toEqual(['log-a', 'log-b'])
    // El actor se resuelve a nombre/avatar/iniciales (email retirado).
    expect(result[0].actor).toEqual({
      userId: USER,
      name: 'Ada Lovelace',
      image: null,
      avatarId: null,
      initials: 'AL',
    })
    // La membresía se verifica contra el id del guild ya resuelto.
    expect(assertGuildMembershipOrThrow).toHaveBeenCalledWith(GUILD, USER)
  })

  it('devuelve [] cuando el guild no tiene actividad', async () => {
    setupMember()
    enqueueSelect([])

    await expect(getGuildRecentActivityHandler(SLUG, USER)).resolves.toEqual([])
  })

  it('propaga Not Found cuando el guild no existe', async () => {
    vi.mocked(resolveGuildBySlugOrThrow).mockRejectedValue(
      new Error('Not Found: guild not found'),
    )

    await expect(getGuildRecentActivityHandler(SLUG, USER)).rejects.toThrow(
      'Not Found: guild not found',
    )
  })

  it('rechaza a un no-miembro con Forbidden y NO consulta la bitácora', async () => {
    vi.mocked(resolveGuildBySlugOrThrow).mockResolvedValue({
      id: GUILD,
      ownerId: 'u-owner',
    })
    vi.mocked(assertGuildMembershipOrThrow).mockRejectedValue(
      new Error('Forbidden: you are not a member of this guild'),
    )

    await expect(getGuildRecentActivityHandler(SLUG, USER)).rejects.toThrow(
      'Forbidden: you are not a member of this guild',
    )
    // La membresía es una puerta: si falla, no debe llegar a leer la bitácora.
    expect(getDbCalls().filter((call) => call.op === 'select')).toHaveLength(0)
  })
})
