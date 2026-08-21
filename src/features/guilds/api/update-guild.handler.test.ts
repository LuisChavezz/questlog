// @vitest-environment node
// Tests de la lógica de updateGuild sin el RPC de TanStack Start: se prueba
// `updateGuildHandler` directamente, con `#/db` mockeado por el stub encadenable
// y `resolveGuildBySlugOrThrow` mockeado (su acceso a BD se testea aparte).
// Cubre el gate de autorización (solo el Guild Master edita el perfil), la
// traducción de descripción vacía a NULL —el único punto donde la entrada del
// formulario no llega literal a la columna— y el ALCANCE de la escritura: un
// UPDATE acotado al id del guild que no toca el slug ni ningún otro campo.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import { guilds } from '#/db/schema'
import { enqueueUpdate, getDbCalls, resetDbStub } from '#/test/drizzle-stub'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'
import { updateGuildHandler } from './update-guild.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('./resolve-guild-or-throw', () => ({
  resolveGuildBySlugOrThrow: vi.fn(),
}))

const SLUG = 'my-guild'
const GUILD = 'guild-1'
const SIBLING_GUILD = 'guild-2' // otro guild, que no debe entrar en el alcance
const OWNER = 'u-owner' // Guild Master — dueño estructural (guilds.owner_id)
const ADMIN = 'u-admin' // Officer
const MEMBER = 'u-member'

// Serializa una condición de Drizzle a SQL + params, para afirmar sobre el
// ALCANCE de una escritura (a qué fila puede llegar) y no solo sobre su tabla.
const dialect = new PgDialect()
function toQuery(condition: unknown) {
  return dialect.sqlToQuery(condition as SQL)
}

function payload(
  overrides: Partial<{ name: string; description: string }> = {},
) {
  return {
    slug: SLUG,
    name: 'Renamed Guild',
    description: 'A new description',
    ...overrides,
  }
}

// Fija el guild resuelto (id + dueño estructural) para el caso bajo prueba.
function setupGuild(ownerId = OWNER) {
  vi.mocked(resolveGuildBySlugOrThrow).mockResolvedValue({
    id: GUILD,
    ownerId,
  })
}

function writes() {
  return getDbCalls().filter((call) => call.op !== 'select')
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('updateGuildHandler — autorización', () => {
  it('propaga Not Found cuando el guild no existe (antes de cualquier permiso)', async () => {
    vi.mocked(resolveGuildBySlugOrThrow).mockRejectedValue(
      new Error('Not Found: guild not found'),
    )

    await expect(updateGuildHandler(payload(), OWNER)).rejects.toThrow(
      'Not Found: guild not found',
    )

    expect(writes()).toHaveLength(0)
  })

  it('rechaza a un Officer (admin) y deja el perfil intacto', async () => {
    setupGuild()

    await expect(updateGuildHandler(payload(), ADMIN)).rejects.toThrow(
      'Forbidden: only the guild owner can edit this guild',
    )

    expect(writes()).toHaveLength(0)
  })

  it('rechaza a un Member y deja el perfil intacto', async () => {
    setupGuild()

    await expect(updateGuildHandler(payload(), MEMBER)).rejects.toThrow(
      'Forbidden: only the guild owner can edit this guild',
    )

    expect(writes()).toHaveLength(0)
  })
})

describe('updateGuildHandler — escritura del perfil', () => {
  it('el Guild Master actualiza nombre y descripción', async () => {
    setupGuild()
    enqueueUpdate([{ id: GUILD }])

    await expect(updateGuildHandler(payload(), OWNER)).resolves.toEqual({
      success: true,
    })

    expect(writes()).toHaveLength(1)
    expect(writes()[0]).toMatchObject({
      op: 'update',
      table: guilds,
      set: { name: 'Renamed Guild', description: 'A new description' },
    })
  })

  it('vaciar la descripción la guarda como NULL, no como cadena vacía', async () => {
    // El formulario manda '' para "borrá la descripción". Si llegara literal a
    // la columna, la app tendría dos representaciones del mismo estado (NULL y
    // '') y cada lectura debería normalizarlas: el header omite la descripción
    // por truthiness, así que '' se vería igual pero no sería lo mismo.
    setupGuild()
    enqueueUpdate([{ id: GUILD }])

    await updateGuildHandler(payload({ description: '' }), OWNER)

    expect(writes()[0].set).toEqual({
      name: 'Renamed Guild',
      description: null,
    })
    expect(writes()[0].set?.description).not.toBe('')
  })

  it('no toca el slug ni ningún campo fuera del perfil', async () => {
    // El slug es inmutable tras la creación (la URL del guild y los links de
    // invitación repartidos cuelgan de él), y el escudo de armas y el invite
    // code tienen sus propios endpoints: este UPDATE escribe exactamente dos
    // columnas.
    setupGuild()
    enqueueUpdate([{ id: GUILD }])

    await updateGuildHandler(payload(), OWNER)

    expect(Object.keys(writes()[0].set ?? {})).toEqual(['name', 'description'])
  })

  it('acota el UPDATE al id del guild, así que un guild hermano no se renombra con él', async () => {
    setupGuild()
    enqueueUpdate([{ id: GUILD }])

    await updateGuildHandler(payload(), OWNER)

    const where = toQuery(writes()[0].where)
    expect(where.sql).toContain('"guilds"."id"')
    expect(where.params).toContain(GUILD)
    expect(where.params).not.toContain(SIBLING_GUILD)
  })

  it('lleva la propiedad DENTRO del WHERE, no solo en el check previo', async () => {
    // La reverificación de propiedad viaja en el mismo statement que la
    // escritura: si una transferencia confirma entre la lectura y el UPDATE, el
    // motor no encuentra fila que actualizar y el ex-owner no llega a renombrar
    // un guild que ya no es suyo. Es el equivalente atómico del SELECT … FOR
    // UPDATE que usan el resto de handlers mutantes de guild.
    setupGuild()
    enqueueUpdate([{ id: GUILD }])

    await updateGuildHandler(payload(), OWNER)

    const where = toQuery(writes()[0].where)
    expect(where.sql).toContain('"guilds"."owner_id"')
    expect(where.params).toEqual([GUILD, OWNER])
  })

  it('confirma con returning() y lanza Conflict si el UPDATE no afectó ninguna fila', async () => {
    // Cero filas con el check previo ya superado solo puede ser cambio
    // concurrente (guild borrado o propiedad transferida). Sin esta verificación
    // el handler devolvía éxito y la UI confirmaba un guardado que no ocurrió.
    setupGuild()
    enqueueUpdate([])

    await expect(updateGuildHandler(payload(), OWNER)).rejects.toThrow(
      'Conflict: the guild changed while saving — please refresh and try again',
    )

    expect(writes()[0].returning).toBe(true)
  })
})
