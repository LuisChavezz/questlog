// @vitest-environment node
// Tests del módulo de consulta/forma de la bitácora: la paginación pura
// (bounds + hasMore) y el shaping de las filas del JOIN (resolución del actor,
// actor NULL, no fuga de email). `#/db` mockeado por el stub encadenable.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { enqueueSelect, getDbCalls, resetDbStub } from '#/test/drizzle-stub'
import {
  countGuildActivityLog,
  getGuildActivityPageBounds,
  GUILD_ACTIVITY_PAGE_SIZE,
  hasMoreActivity,
  queryGuildActivityLog,
} from './guild-activity-log-query'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('getGuildActivityPageBounds', () => {
  it('la página 0 arranca en offset 0', () => {
    expect(getGuildActivityPageBounds(0)).toEqual({
      limit: GUILD_ACTIVITY_PAGE_SIZE,
      offset: 0,
    })
  })

  it('cada página avanza un tamaño de página completo', () => {
    expect(getGuildActivityPageBounds(1)).toEqual({
      limit: GUILD_ACTIVITY_PAGE_SIZE,
      offset: GUILD_ACTIVITY_PAGE_SIZE,
    })
    expect(getGuildActivityPageBounds(3)).toEqual({
      limit: GUILD_ACTIVITY_PAGE_SIZE,
      offset: GUILD_ACTIVITY_PAGE_SIZE * 3,
    })
  })
})

describe('hasMoreActivity', () => {
  it('hay más cuando lo ya cargado no alcanza el total', () => {
    expect(hasMoreActivity(0, 20, 45)).toBe(true)
    expect(hasMoreActivity(20, 20, 45)).toBe(true)
  })

  it('NO hay más en el límite exacto (offset + traído === total)', () => {
    expect(hasMoreActivity(40, 5, 45)).toBe(false)
  })

  it('NO hay más cuando el guild no tiene actividad', () => {
    expect(hasMoreActivity(0, 0, 0)).toBe(false)
  })
})

// Fila cruda del JOIN, como la devolvería el SELECT (log ⋈ quest ⋈ user).
function joinRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    questId: 'quest-1',
    questTitle: 'Slay the dragon',
    eventType: 'field_updated',
    field: 'status',
    oldValue: 'backlog',
    newValue: 'done',
    createdAt: new Date('2026-07-20T10:00:00.000Z'),
    actorId: 'u-actor',
    actorName: 'Grace Hopper',
    actorEmail: 'grace@example.com',
    actorImage: null,
    actorAvatarId: 'avatar-3',
    ...overrides,
  }
}

describe('queryGuildActivityLog — shaping del JOIN', () => {
  it('mapea la fila a su forma de presentación y resuelve el actor con iniciales', async () => {
    enqueueSelect([joinRow()])

    const [entry] = await queryGuildActivityLog('guild-1', { limit: 5 })

    expect(entry).toEqual({
      id: 'log-1',
      questId: 'quest-1',
      questTitle: 'Slay the dragon',
      eventType: 'field_updated',
      field: 'status',
      oldValue: 'backlog',
      newValue: 'done',
      createdAt: new Date('2026-07-20T10:00:00.000Z'),
      actor: {
        userId: 'u-actor',
        name: 'Grace Hopper',
        image: null,
        avatarId: 'avatar-3',
        initials: 'GH',
      },
    })
    // El email solo alimenta las iniciales y NO debe propagarse al cliente.
    expect(entry.actor).not.toHaveProperty('email')
  })

  it('deja el actor en null cuando actorId es NULL (cuenta borrada)', async () => {
    enqueueSelect([
      joinRow({
        eventType: 'created',
        field: null,
        oldValue: null,
        newValue: null,
        actorId: null,
        actorName: null,
        actorEmail: null,
        actorImage: null,
        actorAvatarId: null,
      }),
    ])

    const [entry] = await queryGuildActivityLog('guild-1', { limit: 5 })

    expect(entry.actor).toBeNull()
    expect(entry.eventType).toBe('created')
  })

  it('ordena por createdAt con un desempate estable (id) para la paginación', async () => {
    enqueueSelect([joinRow()])

    await queryGuildActivityLog('guild-1', { limit: 5 })

    const selectCall = getDbCalls().find((call) => call.op === 'select')
    // Dos claves de orden: el criterio principal (createdAt) y el desempate (id).
    // Sin el segundo, las filas de un update multi-campo comparten `created_at`
    // y quedan en orden indefinido, y la paginación por offset del historial
    // puede saltarlas o duplicarlas en el límite entre páginas.
    expect(selectCall?.orderBy).toHaveLength(2)
  })

  it('conserva el orden en que llegan las filas (más recientes primero del SQL)', async () => {
    enqueueSelect([
      joinRow({ id: 'log-a', createdAt: new Date('2026-07-22T00:00:00.000Z') }),
      joinRow({ id: 'log-b', createdAt: new Date('2026-07-21T00:00:00.000Z') }),
      joinRow({ id: 'log-c', createdAt: new Date('2026-07-20T00:00:00.000Z') }),
    ])

    const entries = await queryGuildActivityLog('guild-1', { limit: 5 })

    expect(entries.map((e) => e.id)).toEqual(['log-a', 'log-b', 'log-c'])
  })
})

describe('countGuildActivityLog', () => {
  it('devuelve el total de filas del guild', async () => {
    enqueueSelect([{ total: 42 }])

    await expect(countGuildActivityLog('guild-1')).resolves.toBe(42)
  })
})
