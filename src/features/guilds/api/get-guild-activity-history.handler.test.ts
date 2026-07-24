// @vitest-environment node
// Tests de la lógica del historial paginado. `#/db` mockeado por el stub;
// `resolve-guild-or-throw` mockeado. Cubre los límites de página (hasMore en el
// borde exacto), el caso de guild vacío y el gate de membresía.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { dbStub, enqueueSelect, resetDbStub } from '#/test/drizzle-stub'
import {
  assertGuildMembershipOrThrow,
  resolveGuildBySlugOrThrow,
} from './resolve-guild-or-throw'
import { getGuildActivityHistoryHandler } from './get-guild-activity-history.handler'

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

// N filas crudas del JOIN con ids distintos, para afirmar sobre el conteo/orden.
function makeRows(n: number) {
  return Array.from({ length: n }, (_, index) => ({
    id: `log-${index}`,
    questId: 'quest-1',
    questTitle: 'Slay the dragon',
    eventType: 'field_updated',
    field: 'status',
    oldValue: 'backlog',
    newValue: 'done',
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    actorId: USER,
    actorName: 'Ada Lovelace',
    actorEmail: 'ada@example.com',
    actorImage: null,
    actorAvatarId: null,
  }))
}

function setupMember() {
  vi.mocked(resolveGuildBySlugOrThrow).mockResolvedValue({
    id: GUILD,
    ownerId: 'u-owner',
  })
  vi.mocked(assertGuildMembershipOrThrow).mockResolvedValue({ role: 'member' })
}

// El handler pide la página y el total en un Promise.all: la consulta de filas
// se evalúa antes que el count, así que se encolan en ese orden.
function enqueuePage(rowCount: number, total: number) {
  enqueueSelect(makeRows(rowCount)) // filas de la página
  enqueueSelect([{ total }]) // total del guild
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('getGuildActivityHistoryHandler', () => {
  it('primera página: devuelve items, total y hasMore=true cuando faltan filas', async () => {
    setupMember()
    enqueuePage(20, 45)

    const result = await getGuildActivityHistoryHandler(
      { slug: SLUG, page: 0 },
      USER,
    )

    expect(result.items).toHaveLength(20)
    expect(result.total).toBe(45)
    expect(result.page).toBe(0)
    // offset 0 + 20 traídas < 45 → quedan más.
    expect(result.hasMore).toBe(true)
  })

  it('última página: hasMore=false en el límite exacto (offset + traídas === total)', async () => {
    setupMember()
    enqueuePage(5, 45)

    const result = await getGuildActivityHistoryHandler(
      { slug: SLUG, page: 2 },
      USER,
    )

    // page 2 → offset 40; 40 + 5 = 45 = total → no quedan más. Que dé false
    // confirma además que el offset se derivó de la página (un offset erróneo
    // rompería este borde).
    expect(result.items).toHaveLength(5)
    expect(result.hasMore).toBe(false)
  })

  it('lee la página y el total dentro de una misma transacción (snapshot consistente)', async () => {
    setupMember()
    enqueuePage(20, 45)
    // Espía la transacción del stub (que ejecuta el callback con el propio stub):
    // afirma que la página y el total se piden DENTRO de una transacción, no como
    // dos consultas sueltas que una inserción concurrente podría descuadrar. La
    // garantía real de snapshot depende del MVCC de Postgres —no verificable con
    // el stub—; esto es un guardarraíl a nivel de código contra volver al
    // `Promise.all` sin transacción.
    const txSpy = vi.spyOn(dbStub, 'transaction')

    const result = await getGuildActivityHistoryHandler(
      { slug: SLUG, page: 0 },
      USER,
    )

    expect(txSpy).toHaveBeenCalledTimes(1)
    expect(result.items).toHaveLength(20)
    expect(result.total).toBe(45)

    txSpy.mockRestore()
  })

  it('guild sin actividad: items vacío, total 0 y hasMore=false', async () => {
    setupMember()
    enqueuePage(0, 0)

    const result = await getGuildActivityHistoryHandler(
      { slug: SLUG, page: 0 },
      USER,
    )

    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('rechaza a un no-miembro con Forbidden', async () => {
    vi.mocked(resolveGuildBySlugOrThrow).mockResolvedValue({
      id: GUILD,
      ownerId: 'u-owner',
    })
    vi.mocked(assertGuildMembershipOrThrow).mockRejectedValue(
      new Error('Forbidden: you are not a member of this guild'),
    )

    await expect(
      getGuildActivityHistoryHandler({ slug: SLUG, page: 0 }, USER),
    ).rejects.toThrow('Forbidden: you are not a member of this guild')
  })
})
