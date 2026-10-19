// @vitest-environment node
// Tests de la lógica de regenerateCoatOfArms sin el RPC de TanStack Start: se
// prueba `regenerateCoatOfArmsHandler` directamente, con `#/db` mockeado por el
// stub encadenable y `resolveGuildBySlugOrThrow` / el cliente de Armoria
// mockeados. Cubre la autorización owner-only, el fallo visible de Armoria y la
// reverificación atómica de la propiedad en el WHERE del UPDATE.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import { guilds } from '#/db/schema'
import { enqueueUpdate, getDbCalls, resetDbStub } from '#/test/drizzle-stub'
import { generateCoatOfArmsSvg } from './armoria-client'
import { regenerateCoatOfArmsHandler } from './regenerate-coat-of-arms.handler'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('./resolve-guild-or-throw', () => ({
  resolveGuildBySlugOrThrow: vi.fn(),
}))
vi.mock('./armoria-client', () => ({
  generateCoatOfArmsSvg: vi.fn(),
}))

const SLUG = 'my-guild'
const GUILD = 'guild-1'
const OWNER = 'u-owner' // dueño estructural (guilds.owner_id)
const ADMIN = 'u-admin'
const SVG = '<svg></svg>'

// Serializa una condición de Drizzle a SQL + params, para afirmar sobre el
// ALCANCE de una escritura (a qué fila puede llegar) y no solo sobre su tabla.
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

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('regenerateCoatOfArmsHandler', () => {
  it('rechaza a quien no es el dueño estructural sin llamar a Armoria', async () => {
    setupGuild()

    await expect(
      regenerateCoatOfArmsHandler({ slug: SLUG }, ADMIN),
    ).rejects.toThrow(
      'Forbidden: only the guild owner can regenerate the coat of arms',
    )
    expect(generateCoatOfArmsSvg).not.toHaveBeenCalled()
    expect(getDbCalls()).toHaveLength(0)
  })

  it('lanza si Armoria falla y no escribe nada', async () => {
    setupGuild()
    vi.mocked(generateCoatOfArmsSvg).mockResolvedValue(null)

    await expect(
      regenerateCoatOfArmsHandler({ slug: SLUG }, OWNER),
    ).rejects.toThrow(
      'Could not generate a new coat of arms right now. Please try again.',
    )
    expect(getDbCalls()).toHaveLength(0)
  })

  it('el Guild Master guarda el escudo nuevo con un seed derivado del guild', async () => {
    setupGuild()
    vi.mocked(generateCoatOfArmsSvg).mockResolvedValue(SVG)
    enqueueUpdate([{ id: GUILD }])

    await expect(
      regenerateCoatOfArmsHandler({ slug: SLUG }, OWNER),
    ).resolves.toEqual({ coatOfArmsSvg: SVG })

    const [update] = getDbCalls()
    expect(update).toMatchObject({
      op: 'update',
      table: guilds,
      set: { coatOfArmsSvg: SVG },
      returning: true,
    })
    expect(update.set?.coatOfArmsSeed).toMatch(new RegExp(`^${GUILD}-`))
  })

  it('lleva la propiedad DENTRO del WHERE, no solo en el check previo', async () => {
    setupGuild()
    vi.mocked(generateCoatOfArmsSvg).mockResolvedValue(SVG)
    enqueueUpdate([{ id: GUILD }])

    await regenerateCoatOfArmsHandler({ slug: SLUG }, OWNER)

    const where = toQuery(getDbCalls()[0].where)
    expect(where.sql).toContain('"guilds"."owner_id"')
    expect(where.params).toEqual([GUILD, OWNER])
  })

  it('lanza Conflict si la propiedad cambió mientras se generaba el escudo', async () => {
    setupGuild()
    vi.mocked(generateCoatOfArmsSvg).mockResolvedValue(SVG)
    enqueueUpdate([]) // una transferencia confirmó: el WHERE no encuentra fila

    await expect(
      regenerateCoatOfArmsHandler({ slug: SLUG }, OWNER),
    ).rejects.toThrow(
      'Conflict: the guild changed while regenerating the coat of arms — please refresh and try again',
    )
  })
})
