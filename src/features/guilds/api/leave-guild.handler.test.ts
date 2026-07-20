// @vitest-environment node
// Tests de la lógica de leaveGuild sin el RPC de TanStack Start: se prueba
// `leaveGuildHandler` directamente, con `#/db` mockeado por el stub encadenable y
// `resolveGuildBySlugOrThrow` mockeado (su acceso a BD se testea aparte). Cubre
// la salida normal, el gate del owner (debe transferir primero) y el caso de
// quien no es miembro.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { guildMembers } from '#/db/schema'
import { enqueueDelete, getDbCalls, resetDbStub } from '#/test/drizzle-stub'
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

describe('leaveGuildHandler', () => {
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
    enqueueDelete([{ id: 'membership-1' }])

    await expect(leaveGuildHandler({ slug: SLUG }, MEMBER)).resolves.toEqual({
      slug: SLUG,
    })
  })

  it('borra su membresía sobre guild_members y confirma con returning', async () => {
    setupGuild()
    enqueueDelete([{ id: 'membership-1' }])

    await leaveGuildHandler({ slug: SLUG }, MEMBER)

    const calls = getDbCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      op: 'delete',
      table: guildMembers,
      returning: true,
    })
  })

  it('un Officer también puede abandonar — el gate solo aplica al owner', async () => {
    setupGuild()
    enqueueDelete([{ id: 'membership-admin' }])

    await expect(leaveGuildHandler({ slug: SLUG }, 'u-admin')).resolves.toEqual(
      {
        slug: SLUG,
      },
    )
  })

  it('lanza Forbidden cuando el dueño estructural intenta salir', async () => {
    setupGuild()

    // Debe transferir la propiedad antes; el gate corta antes de borrar nada,
    // igual que la UI de Settings deshabilita la acción para el Guild Master.
    await expect(leaveGuildHandler({ slug: SLUG }, OWNER)).rejects.toThrow(
      'Forbidden: you must transfer ownership before leaving this guild',
    )
    expect(getDbCalls()).toHaveLength(0)
  })

  it('lanza Forbidden cuando quien sale no es miembro del guild', async () => {
    setupGuild()
    enqueueDelete([]) // returning() vacío: no había membresía que borrar

    await expect(
      leaveGuildHandler({ slug: SLUG }, 'u-stranger'),
    ).rejects.toThrow('Forbidden: you are not a member of this guild')
  })
})
