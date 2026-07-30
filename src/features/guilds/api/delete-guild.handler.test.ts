// @vitest-environment node
// Tests de la lógica de deleteGuild sin el RPC de TanStack Start: se prueba
// `deleteGuildHandler` directamente, con `#/db` mockeado por el stub encadenable
// y `resolveGuildBySlugOrThrow` mockeado (su acceso a BD se testea aparte).
// Cubre el gate de autorización (solo el Guild Master), la reverificación de
// propiedad contra la fila BLOQUEADA —la carrera TOCTOU que esta función existe
// para cerrar, misma estructura que el test de transfer-guild-ownership— y que
// el borrado sea una ÚNICA escritura acotada al guild, delegando el resto en las
// cascadas del esquema (verificadas en db/schema/guild-cascade.test.ts).
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import {
  guildMembers,
  guildQuestActivityLog,
  guilds,
  quests,
} from '#/db/schema'
import {
  enqueueDelete,
  enqueueError,
  enqueueSelect,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import { deleteGuildHandler } from './delete-guild.handler'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('./resolve-guild-or-throw', () => ({
  resolveGuildBySlugOrThrow: vi.fn(),
}))

const SLUG = 'my-guild'
const GUILD = 'guild-1'
const SIBLING_GUILD = 'guild-2' // otro guild del mismo usuario, que no se toca
const OWNER = 'u-owner' // Guild Master — dueño estructural (guilds.owner_id)
const ADMIN = 'u-admin' // Officer
const MEMBER = 'u-member'

// Serializa una condición de Drizzle a SQL + params, para afirmar sobre el
// ALCANCE de una escritura (a qué fila puede llegar) y no solo sobre su tabla.
const dialect = new PgDialect()
function toQuery(condition: unknown) {
  return dialect.sqlToQuery(condition as SQL)
}

function payload() {
  return { slug: SLUG }
}

// Fija el guild resuelto (id + dueño estructural) para el caso bajo prueba.
function setupGuild(ownerId = OWNER) {
  vi.mocked(resolveGuildBySlugOrThrow).mockResolvedValue({
    id: GUILD,
    ownerId,
  })
}

/**
 * Encola las lecturas/escrituras de un borrado completo. Por defecto la fila
 * bloqueada coincide con la previa (sin carrera) y el DELETE afecta a una fila;
 * cada override simula un cambio concurrente en ese punto exacto.
 */
function enqueueDeletionFlow(
  opts: {
    lockedGuild?: { id: string; ownerId: string }[]
    deleted?: { id: string }[]
  } = {},
) {
  enqueueSelect(opts.lockedGuild ?? [{ id: GUILD, ownerId: OWNER }])
  enqueueDelete(opts.deleted ?? [{ id: GUILD }])
}

function writes() {
  return getDbCalls().filter((call) => call.op !== 'select')
}

const GUILD_CHANGED_CONFLICT =
  'Conflict: the guild changed while deleting — please refresh and try again'

// Error tal y como lo entrega Drizzle: el del driver `pg` —que es quien lleva el
// SQLSTATE en `code`— envuelto en el error de consulta, con el original en
// `cause`. El handler solo ve el de fuera, así que el `code` no está en la raíz.
function drizzleError(code: string, message: string) {
  return new Error('Failed query: delete from "guilds" where "id" = $1', {
    cause: Object.assign(new Error(message), { code }),
  })
}

// 40P01 = deadlock detected. Se dispara cuando un borrado de guild (que bloquea
// `guilds` y cascadea a `quests`) se cruza con una edición de quest de ese mismo
// guild (que bloquea la quest y luego toca `guilds` vía la FK de la bitácora).
function deadlockError() {
  return drizzleError('40P01', 'deadlock detected')
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('deleteGuildHandler — autorización', () => {
  it('propaga Not Found cuando el guild no existe (antes de cualquier permiso)', async () => {
    vi.mocked(resolveGuildBySlugOrThrow).mockRejectedValue(
      new Error('Not Found: guild not found'),
    )

    await expect(deleteGuildHandler(payload(), OWNER)).rejects.toThrow(
      'Not Found: guild not found',
    )
  })

  it('el Guild Master borra su guild', async () => {
    setupGuild()
    enqueueDeletionFlow()

    await expect(deleteGuildHandler(payload(), OWNER)).resolves.toEqual({
      guildId: GUILD,
      slug: SLUG,
    })
  })

  it('rechaza a un Officer (admin) y deja el guild intacto', async () => {
    setupGuild()

    await expect(deleteGuildHandler(payload(), ADMIN)).rejects.toThrow(
      'Forbidden: only the guild owner can delete this guild',
    )

    // Ni siquiera abre la transacción: no hay una sola escritura.
    expect(writes()).toHaveLength(0)
  })

  it('rechaza a un Member y deja el guild intacto', async () => {
    setupGuild()

    await expect(deleteGuildHandler(payload(), MEMBER)).rejects.toThrow(
      'Forbidden: only the guild owner can delete this guild',
    )

    expect(writes()).toHaveLength(0)
  })
})

describe('deleteGuildHandler — reverificación bajo bloqueo de fila', () => {
  it('relee el guild CON bloqueo antes de borrar', async () => {
    setupGuild()
    enqueueDeletionFlow()

    await deleteGuildHandler(payload(), OWNER)

    const calls = getDbCalls()
    expect(calls[0]).toMatchObject({
      op: 'select',
      table: guilds,
      locked: true,
    })
    expect(calls[1]).toMatchObject({ op: 'delete', table: guilds })
  })

  it('aborta con Conflict si la propiedad ya cambió en la fila bloqueada, SIN borrar', async () => {
    // El check previo pasa: para el snapshot, OWNER sigue siendo el Guild
    // Master. Pero entre ese check y el bloqueo, una transferencia de propiedad
    // confirmó — el ex-owner ya no puede arrastrar el guild entero.
    setupGuild()
    enqueueDeletionFlow({
      lockedGuild: [{ id: GUILD, ownerId: 'u-new-owner' }],
    })

    await expect(deleteGuildHandler(payload(), OWNER)).rejects.toThrow(
      'Conflict: ownership has already changed — please refresh and try again',
    )

    // Lo esencial de esta función: la lectura bloqueada GATEA el borrado. Si
    // llegara a ejecutarse, un ex-owner borraría el guild del nuevo owner.
    expect(writes()).toHaveLength(0)
  })

  it('aborta con Conflict si la fila del guild desapareció al bloquear', async () => {
    setupGuild()
    enqueueDeletionFlow({ lockedGuild: [] })

    await expect(deleteGuildHandler(payload(), OWNER)).rejects.toThrow(
      'Conflict: the guild changed while deleting — please refresh and try again',
    )
    expect(writes()).toHaveLength(0)
  })

  it('aborta con Conflict si el DELETE no afectó a ninguna fila', async () => {
    setupGuild()
    enqueueDeletionFlow({ deleted: [] })

    await expect(deleteGuildHandler(payload(), OWNER)).rejects.toThrow(
      'Conflict: the guild changed while deleting — please refresh and try again',
    )
  })
})

describe('deleteGuildHandler — alcance del borrado', () => {
  it('emite un único DELETE sobre guilds y delega el resto en las cascadas', async () => {
    setupGuild()
    enqueueDeletionFlow()

    await deleteGuildHandler(payload(), OWNER)

    // Una sola escritura, sobre `guilds`, con returning() para confirmar que la
    // fila seguía existiendo.
    expect(writes()).toHaveLength(1)
    expect(writes()[0]).toMatchObject({
      op: 'delete',
      table: guilds,
      returning: true,
    })

    // Las filas hijas NO se borran a mano: eso duplicaría lo que el esquema ya
    // garantiza y podría desincronizarse de él.
    const touchedTables = writes().map((call) => call.table)
    expect(touchedTables).not.toContain(guildMembers)
    expect(touchedTables).not.toContain(quests)
    expect(touchedTables).not.toContain(guildQuestActivityLog)
  })

  it('acota el DELETE al id del guild, así que un guild hermano no cae con él', async () => {
    setupGuild()
    enqueueDeletionFlow()

    await deleteGuildHandler(payload(), OWNER)

    // El DELETE va por id (el de la fila que se bloqueó y verificó), no por un
    // criterio más ancho: ningún otro guild —ni sus miembros, quests o bitácora,
    // que cascadean por su propio guild_id— entra en el alcance de esta escritura.
    const where = toQuery(writes()[0].where)
    expect(where.sql).toContain('"guilds"."id"')
    expect(where.params).toEqual([GUILD])
    expect(where.params).not.toContain(SIBLING_GUILD)
  })
})

describe('deleteGuildHandler — reintento por deadlock', () => {
  it('repite la transacción entera cuando Postgres la aborta por deadlock', async () => {
    setupGuild()
    // Primer intento: la fila se bloquea y el DELETE muere en el deadlock.
    enqueueSelect([{ id: GUILD, ownerId: OWNER }])
    enqueueError('delete', deadlockError())
    // Segundo intento: la transacción se repite completa y esta vez pasa.
    enqueueDeletionFlow()

    await expect(deleteGuildHandler(payload(), OWNER)).resolves.toEqual({
      guildId: GUILD,
      slug: SLUG,
    })

    // Lo esencial del reintento: NO reanuda donde murió. Vuelve a bloquear la
    // fila y a reverificar la propiedad antes del segundo DELETE — si se saltara
    // el bloqueo, la segunda pasada escribiría sobre un estado sin verificar.
    expect(getDbCalls().map((call) => call.op)).toEqual([
      'select',
      'delete',
      'select',
      'delete',
    ])
    const lockedReads = getDbCalls().filter(
      (call) => call.op === 'select' && call.locked,
    )
    expect(lockedReads).toHaveLength(2)
  })

  it('con el deadlock persistente devuelve el Conflict de siempre, sin filtrar el error de Postgres', async () => {
    setupGuild()
    enqueueSelect([{ id: GUILD, ownerId: OWNER }])
    enqueueError('delete', deadlockError())
    enqueueSelect([{ id: GUILD, ownerId: OWNER }])
    enqueueError('delete', deadlockError())

    const error = await deleteGuildHandler(payload(), OWNER).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(Error)
    // El usuario ve el mismo mensaje que ante cualquier otra carrera perdida…
    expect((error as Error).message).toBe(GUILD_CHANGED_CONFLICT)
    // …y nunca el «deadlock detected» crudo del motor.
    expect((error as Error).message).not.toContain('deadlock')
    expect((error as Error).message).not.toContain('Failed query')

    // Exactamente dos intentos: un solo reintento, no un bucle.
    expect(writes()).toHaveLength(2)
  })

  it('no reintenta un conflicto de propiedad: falla en el primer intento', async () => {
    // Que el ex-owner haya perdido la propiedad no es transitorio — repetir la
    // transacción daría el mismo rechazo y solo retrasaría el error.
    setupGuild()
    enqueueDeletionFlow({
      lockedGuild: [{ id: GUILD, ownerId: 'u-new-owner' }],
    })

    await expect(deleteGuildHandler(payload(), OWNER)).rejects.toThrow(
      'Conflict: ownership has already changed — please refresh and try again',
    )

    // Una sola lectura bloqueada y ninguna escritura: no hubo segunda pasada.
    expect(getDbCalls().filter((call) => call.op === 'select')).toHaveLength(1)
    expect(writes()).toHaveLength(0)
  })

  it('no reintenta un error de base de datos que no sea deadlock', async () => {
    // 23503 = foreign_key_violation. No es un choque de bloqueos, así que se
    // propaga tal cual en vez de repetirse o disfrazarse de conflicto.
    setupGuild()
    const fkViolation = drizzleError('23503', 'fk violation')
    enqueueSelect([{ id: GUILD, ownerId: OWNER }])
    enqueueError('delete', fkViolation)

    await expect(deleteGuildHandler(payload(), OWNER)).rejects.toBe(fkViolation)

    expect(writes()).toHaveLength(1)
  })
})
