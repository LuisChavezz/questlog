// @vitest-environment node
// Tests de la lógica de regenerateInviteCode sin el RPC de TanStack Start: se
// prueba `regenerateInviteCodeHandler` directamente, con `#/db` mockeado por el
// stub encadenable. Cubre la autorización owner-only (estructural) y la
// reverificación atómica de la propiedad en el WHERE del UPDATE.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import { guilds } from '#/db/schema'
import {
  enqueueSelect,
  enqueueUpdate,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import { regenerateInviteCodeHandler } from './regenerate-invite-code.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))

const GUILD = 'guild-1'
const OWNER = 'u-owner' // dueño estructural (guilds.owner_id)
const ADMIN = 'u-admin'

// Serializa una condición de Drizzle a SQL + params, para afirmar sobre el
// ALCANCE de una escritura (a qué fila puede llegar) y no solo sobre su tabla.
const dialect = new PgDialect()
function toQuery(condition: unknown) {
  return dialect.sqlToQuery(condition as SQL)
}

function writes() {
  return getDbCalls().filter((call) => call.op !== 'select')
}

// Guild resuelto en la comprobación previa. El chequeo de unicidad del código
// generado lo encola cada test aparte (con o sin colisión).
function enqueueGuild(ownerId = OWNER) {
  enqueueSelect([{ id: GUILD, ownerId }])
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('regenerateInviteCodeHandler — autorización', () => {
  it('lanza Not Found cuando el guild no existe', async () => {
    enqueueSelect([])

    await expect(
      regenerateInviteCodeHandler({ guildId: GUILD }, OWNER),
    ).rejects.toThrow('Not Found: guild not found')
    expect(writes()).toHaveLength(0)
  })

  it('rechaza a quien no es el dueño estructural (aunque sea Officer)', async () => {
    enqueueGuild()

    await expect(
      regenerateInviteCodeHandler({ guildId: GUILD }, ADMIN),
    ).rejects.toThrow(
      'Forbidden: only the guild owner can regenerate the invite code',
    )
    expect(writes()).toHaveLength(0)
  })
})

describe('regenerateInviteCodeHandler — escritura', () => {
  it('el Guild Master obtiene un código nuevo de 8 caracteres', async () => {
    enqueueGuild()
    enqueueSelect([]) // el código generado no colisiona
    enqueueUpdate([{ id: GUILD }])

    const result = await regenerateInviteCodeHandler({ guildId: GUILD }, OWNER)

    expect(result.inviteCode).toMatch(/^[2-9A-HJ-NP-Za-km-z]{8}$/)
    expect(writes()).toHaveLength(1)
    expect(writes()[0]).toMatchObject({
      op: 'update',
      table: guilds,
      set: { inviteCode: result.inviteCode },
      returning: true,
    })
  })

  it('lleva la propiedad DENTRO del WHERE, no solo en el check previo', async () => {
    enqueueGuild()
    enqueueSelect([])
    enqueueUpdate([{ id: GUILD }])

    await regenerateInviteCodeHandler({ guildId: GUILD }, OWNER)

    const where = toQuery(writes()[0].where)
    expect(where.sql).toContain('"guilds"."id"')
    expect(where.sql).toContain('"guilds"."owner_id"')
    expect(where.params).toEqual([GUILD, OWNER])
  })

  it('lanza Conflict si la propiedad cambió entre el check y el UPDATE', async () => {
    enqueueGuild()
    enqueueSelect([])
    enqueueUpdate([]) // una transferencia confirmó: el WHERE no encuentra fila

    await expect(
      regenerateInviteCodeHandler({ guildId: GUILD }, OWNER),
    ).rejects.toThrow(
      'Conflict: the guild changed while regenerating the invite code — please refresh and try again',
    )
  })

  it('reintenta si el código generado ya existe', async () => {
    enqueueGuild()
    enqueueSelect([{ id: 'other-guild' }]) // 1.er intento colisiona
    enqueueSelect([]) // 2.º intento libre
    enqueueUpdate([{ id: GUILD }])

    await expect(
      regenerateInviteCodeHandler({ guildId: GUILD }, OWNER),
    ).resolves.toHaveProperty('inviteCode')

    const selects = getDbCalls().filter((call) => call.op === 'select')
    expect(selects).toHaveLength(3)
  })

  it('lanza en inglés si no consigue un código único', async () => {
    enqueueGuild()
    for (let i = 0; i < 10; i++) enqueueSelect([{ id: 'other-guild' }])

    await expect(
      regenerateInviteCodeHandler({ guildId: GUILD }, OWNER),
    ).rejects.toThrow(
      'Could not generate a unique invite code after several attempts',
    )
    expect(writes()).toHaveLength(0)
  })
})
