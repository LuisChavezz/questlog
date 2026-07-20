// @vitest-environment node
// Tests de la lógica de updateGuildMemberRole sin el RPC de TanStack Start: se
// prueba `updateGuildMemberRoleHandler` directamente, con `#/db` mockeado por el
// stub encadenable y `resolveGuildBySlugOrThrow` mockeado (su acceso a BD se
// testea aparte). Cubre la autorización owner-only, la inmutabilidad del rol del
// owner por esta vía y el gate de returning() cuando el objetivo no es miembro.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { guildMembers } from '#/db/schema'
import { enqueueUpdate, getDbCalls, resetDbStub } from '#/test/drizzle-stub'
import type { AssignableGuildRole } from '../schemas/guild-schemas'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'
import { updateGuildMemberRoleHandler } from './update-guild-member-role.handler'

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

function payload(userId = MEMBER, newRole: AssignableGuildRole = 'admin') {
  return { slug: SLUG, userId, newRole }
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

describe('updateGuildMemberRoleHandler', () => {
  it('propaga Not Found cuando el guild no existe', async () => {
    vi.mocked(resolveGuildBySlugOrThrow).mockRejectedValue(
      new Error('Not Found: guild not found'),
    )

    await expect(
      updateGuildMemberRoleHandler(payload(), OWNER),
    ).rejects.toThrow('Not Found: guild not found')
  })

  it('el owner promueve a un Member a Officer', async () => {
    setupGuild()
    enqueueUpdate([{ id: 'membership-1' }])

    await expect(
      updateGuildMemberRoleHandler(payload(MEMBER, 'admin'), OWNER),
    ).resolves.toEqual({ userId: MEMBER, role: 'admin' })
  })

  it('el owner degrada a un Officer a Member', async () => {
    setupGuild()
    enqueueUpdate([{ id: 'membership-1' }])

    await expect(
      updateGuildMemberRoleHandler(payload('u-admin', 'member'), OWNER),
    ).resolves.toEqual({ userId: 'u-admin', role: 'member' })
  })

  it('escribe el rol pedido sobre guild_members y confirma con returning', async () => {
    setupGuild()
    enqueueUpdate([{ id: 'membership-1' }])

    await updateGuildMemberRoleHandler(payload(MEMBER, 'admin'), OWNER)

    const calls = getDbCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      op: 'update',
      table: guildMembers,
      set: { role: 'admin' },
      returning: true,
    })
  })

  it('lanza Forbidden cuando quien cambia el rol no es el owner', async () => {
    setupGuild()

    // Ni siquiera un Officer puede: el cambio de roles es owner-only.
    await expect(
      updateGuildMemberRoleHandler(payload(), 'u-admin'),
    ).rejects.toThrow('Forbidden: only the guild owner can change member roles')
    expect(getDbCalls()).toHaveLength(0)
  })

  it('lanza Forbidden cuando el objetivo es el propio owner', async () => {
    setupGuild()

    // El rol del owner es estructural: solo cambia transfiriendo la propiedad.
    await expect(
      updateGuildMemberRoleHandler(payload(OWNER, 'member'), OWNER),
    ).rejects.toThrow("Forbidden: the guild owner's role cannot be changed")
    expect(getDbCalls()).toHaveLength(0)
  })

  it('lanza Not Found cuando el objetivo no es miembro del guild', async () => {
    setupGuild()
    enqueueUpdate([]) // returning() vacío: no había fila que actualizar

    await expect(
      updateGuildMemberRoleHandler(payload('u-ghost'), OWNER),
    ).rejects.toThrow('Not Found: member not found in this guild')
  })
})
