// @vitest-environment node
// Tests de la lógica de leaveGuild sin el RPC de TanStack Start: se prueba
// `leaveGuildHandler` directamente, con `#/db` mockeado por el stub encadenable y
// `resolveGuildBySlugOrThrow` mockeado (su acceso a BD se testea aparte). Cubre
// la salida normal, el gate del owner (debe transferir primero), el caso de
// quien no es miembro, la reverificación TOCTOU bajo bloqueo y la limpieza de
// asignado/supervisor en las quests del guild.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import { guildMembers, guilds, quests } from '#/db/schema'
import {
  enqueueDelete,
  enqueueError,
  enqueueSelect,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import { leaveGuildHandler } from './leave-guild.handler'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('./resolve-guild-or-throw', () => ({
  resolveGuildBySlugOrThrow: vi.fn(),
}))

const SLUG = 'my-guild'
const GUILD = 'guild-1'
const OWNER = 'u-owner' // dueño estructural (guilds.owner_id)
const MEMBER = 'u-member'

// Serializa una condición de Drizzle a SQL + params, para afirmar sobre el
// ALCANCE de una escritura (a qué filas puede llegar) y no solo sobre su tabla.
const dialect = new PgDialect()
function toQuery(condition: unknown) {
  return dialect.sqlToQuery(condition as SQL)
}

// Fija el guild resuelto (id + dueño estructural) para el caso bajo prueba.
function setupGuild(ownerId = OWNER) {
  vi.mocked(resolveGuildBySlugOrThrow).mockResolvedValue({
    id: GUILD,
    ownerId,
  })
}

/**
 * Encola las lecturas/escrituras de una salida completa. Por defecto el estado
 * bloqueado es idéntico al previo (sin carrera) y el borrado afecta a una fila;
 * cada override simula un cambio concurrente en ese punto exacto.
 */
function enqueueLeaveFlow(
  opts: {
    locked?: { id: string }[]
    currentOwnerId?: string
    deleted?: { id: string }[]
  } = {},
) {
  enqueueSelect([{ id: 'membership-1' }]) // lectura previa de la membresía
  enqueueSelect(opts.locked ?? [{ id: 'membership-1' }]) // relectura bloqueada
  enqueueSelect([{ ownerId: opts.currentOwnerId ?? OWNER }]) // owner estructural
  enqueueDelete(opts.deleted ?? [{ id: 'membership-1' }]) // borrado
}

// Error tal y como lo entrega Drizzle: el del driver `pg` —que lleva el
// SQLSTATE en `code`— envuelto en el error de consulta, con el original en
// `cause`. 40P01 = deadlock detected.
function deadlockError() {
  return new Error('Failed query: update "quests" set "assignee_id" = $1', {
    cause: Object.assign(new Error('deadlock detected'), { code: '40P01' }),
  })
}

// Una pasada de la transacción (sin la lectura previa): relectura bloqueada,
// owner estructural y borrado de la membresía.
function enqueueTransactionAttempt() {
  enqueueSelect([{ id: 'membership-1' }])
  enqueueSelect([{ ownerId: OWNER }])
  enqueueDelete([{ id: 'membership-1' }])
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('leaveGuildHandler — comprobación previa', () => {
  it('propaga Not Found cuando el guild no existe', async () => {
    vi.mocked(resolveGuildBySlugOrThrow).mockRejectedValue(
      new Error('Not Found: guild not found'),
    )

    await expect(leaveGuildHandler({ slug: SLUG }, MEMBER)).rejects.toThrow(
      'Not Found: guild not found',
    )
  })

  it('un miembro no-owner abandona el guild', async () => {
    setupGuild()
    enqueueLeaveFlow()

    await expect(leaveGuildHandler({ slug: SLUG }, MEMBER)).resolves.toEqual({
      slug: SLUG,
    })
  })

  it('un Officer también puede abandonar — el gate solo aplica al owner', async () => {
    setupGuild()
    enqueueLeaveFlow()

    await expect(leaveGuildHandler({ slug: SLUG }, 'u-admin')).resolves.toEqual(
      { slug: SLUG },
    )
  })

  it('lanza Forbidden cuando el dueño estructural intenta salir', async () => {
    setupGuild()

    // Debe transferir la propiedad antes; el gate corta antes de leer o borrar
    // nada, igual que la UI de Settings deshabilita la acción para el Guild Master.
    await expect(leaveGuildHandler({ slug: SLUG }, OWNER)).rejects.toThrow(
      'Forbidden: you must transfer ownership before leaving this guild',
    )
    expect(getDbCalls()).toHaveLength(0)
  })

  it('lanza Forbidden cuando quien sale no es miembro del guild', async () => {
    setupGuild()
    enqueueSelect([]) // la lectura previa no encuentra membresía

    await expect(
      leaveGuildHandler({ slug: SLUG }, 'u-stranger'),
    ).rejects.toThrow('Forbidden: you are not a member of this guild')
    expect(getDbCalls().filter((call) => call.op !== 'select')).toHaveLength(0)
  })
})

describe('leaveGuildHandler — reverificación TOCTOU bajo bloqueo', () => {
  it('relee la membresía CON bloqueo y el owner SIN bloqueo, antes de borrar', async () => {
    setupGuild()
    enqueueLeaveFlow()

    await leaveGuildHandler({ slug: SLUG }, MEMBER)

    const calls = getDbCalls()
    expect(calls[0]).toMatchObject({
      op: 'select',
      table: guildMembers,
      locked: false,
    })
    expect(calls[1]).toMatchObject({
      op: 'select',
      table: guildMembers,
      locked: true,
    })
    // Owner estructural releído deliberadamente SIN bloqueo (MVCC) para no
    // invertir el orden guilds → guild_members de transfer/delete-guild.
    expect(calls[2]).toMatchObject({
      op: 'select',
      table: guilds,
      locked: false,
    })
    expect(calls[3]).toMatchObject({
      op: 'delete',
      table: guildMembers,
      returning: true,
    })
  })

  it('aborta con Conflict si quien sale recibió la propiedad durante la carrera', async () => {
    setupGuild()
    enqueueLeaveFlow({
      // Una transferencia concurrente confirmó: quien sale ya es el owner. La
      // comprobación previa vio otro owner y pasó; el bloqueo lo detecta.
      currentOwnerId: MEMBER,
    })

    await expect(leaveGuildHandler({ slug: SLUG }, MEMBER)).rejects.toThrow(
      'Conflict: you are now the guild owner — please refresh and try again',
    )
    // Ni membresía borrada ni quests tocadas: el guild no queda sin owner.
    expect(getDbCalls().filter((call) => call.op !== 'select')).toHaveLength(0)
  })

  it('aborta con Conflict si la membresía desapareció antes del bloqueo', async () => {
    setupGuild()
    enqueueLeaveFlow({ locked: [] })

    await expect(leaveGuildHandler({ slug: SLUG }, MEMBER)).rejects.toThrow(
      'Conflict: your membership changed while leaving — please refresh and try again',
    )
    expect(getDbCalls().filter((call) => call.op !== 'select')).toHaveLength(0)
  })

  it('aborta con Conflict si el borrado no afecta a ninguna fila', async () => {
    setupGuild()
    enqueueLeaveFlow({ deleted: [] })

    await expect(leaveGuildHandler({ slug: SLUG }, MEMBER)).rejects.toThrow(
      'Conflict: your membership changed while leaving — please refresh and try again',
    )
    expect(getDbCalls().filter((call) => call.op === 'update')).toHaveLength(0)
  })
})

describe('leaveGuildHandler — limpieza de asignaciones', () => {
  it('limpia asignado y supervisor de quien sale, después del borrado', async () => {
    setupGuild()
    enqueueLeaveFlow()

    await leaveGuildHandler({ slug: SLUG }, MEMBER)

    const writes = getDbCalls().filter((call) => call.op !== 'select')
    expect(writes.map((call) => call.op)).toEqual([
      'delete',
      'update',
      'update',
    ])
    expect(writes[1]).toMatchObject({
      table: quests,
      set: { assigneeId: null },
    })
    expect(writes[2]).toMatchObject({
      table: quests,
      set: { supervisorId: null },
    })
  })

  it('acota cada limpieza a las quests de ESTE guild que apuntan a quien sale', async () => {
    setupGuild()
    enqueueLeaveFlow()

    await leaveGuildHandler({ slug: SLUG }, MEMBER)

    const [assigneeUpdate, supervisorUpdate] = getDbCalls().filter(
      (call) => call.op === 'update',
    )

    const assigneeWhere = toQuery(assigneeUpdate.where)
    expect(assigneeWhere.sql).toContain('"quests"."guild_id"')
    expect(assigneeWhere.sql).toContain('"quests"."assignee_id"')
    expect(assigneeWhere.params).toEqual([GUILD, MEMBER])

    const supervisorWhere = toQuery(supervisorUpdate.where)
    expect(supervisorWhere.sql).toContain('"quests"."guild_id"')
    expect(supervisorWhere.sql).toContain('"quests"."supervisor_id"')
    expect(supervisorWhere.params).toEqual([GUILD, MEMBER])
  })

  it('acota el borrado de membresía al guild y al usuario que sale', async () => {
    setupGuild()
    enqueueLeaveFlow()

    await leaveGuildHandler({ slug: SLUG }, MEMBER)

    const deleteCall = getDbCalls().find((call) => call.op === 'delete')
    expect(toQuery(deleteCall?.where).params).toEqual([GUILD, MEMBER])
  })
})

describe('leaveGuildHandler — reintento por deadlock', () => {
  it('repite la transacción entera cuando Postgres la aborta por deadlock', async () => {
    setupGuild()
    enqueueSelect([{ id: 'membership-1' }]) // lectura previa
    enqueueTransactionAttempt()
    // La limpieza de asignado muere en el deadlock (cruce con update-quest).
    enqueueError('update', deadlockError())
    enqueueTransactionAttempt() // segundo intento, sin error

    await expect(leaveGuildHandler({ slug: SLUG }, MEMBER)).resolves.toEqual({
      slug: SLUG,
    })

    // Dos pasadas completas: dos relecturas bloqueadas y dos borrados.
    const calls = getDbCalls()
    expect(calls.filter((call) => call.locked)).toHaveLength(2)
    expect(calls.filter((call) => call.op === 'delete')).toHaveLength(2)
  })

  it('con el deadlock persistente devuelve el Conflict de siempre, sin filtrar el error de Postgres', async () => {
    setupGuild()
    enqueueSelect([{ id: 'membership-1' }])
    enqueueTransactionAttempt()
    enqueueError('update', deadlockError())
    enqueueTransactionAttempt()
    enqueueError('update', deadlockError())

    const error = await leaveGuildHandler({ slug: SLUG }, MEMBER).catch(
      (caught: unknown) => caught,
    )

    expect((error as Error).message).toBe(
      'Conflict: your membership changed while leaving — please refresh and try again',
    )
    expect((error as Error).message).not.toContain('deadlock')
    expect((error as Error).message).not.toContain('Failed query')
  })
})
