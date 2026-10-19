// @vitest-environment node
// Tests de la lógica de updateGuildMemberRole sin el RPC de TanStack Start: se
// prueba `updateGuildMemberRoleHandler` directamente, con `#/db` mockeado por el
// stub encadenable y `resolveGuildBySlugOrThrow` mockeado (su acceso a BD se
// testea aparte). Cubre la autorización owner-only, la inmutabilidad del rol del
// owner por esta vía, el objetivo que no es miembro y la reverificación TOCTOU
// bajo bloqueo frente a una transferencia de propiedad concurrente.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { guildMembers, guilds } from '#/db/schema'
import {
  enqueueSelect,
  enqueueUpdate,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
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

/**
 * Encola las lecturas/escrituras de un cambio de rol completo. Por defecto el
 * estado bloqueado es idéntico al previo (sin carrera) y el UPDATE afecta a una
 * fila; cada override simula un cambio concurrente en ese punto exacto.
 */
function enqueueRoleChangeFlow(
  opts: {
    locked?: { id: string }[]
    currentOwnerId?: string
    guildGone?: boolean
    updated?: { id: string }[]
  } = {},
) {
  enqueueSelect([{ id: 'membership-1' }]) // lectura previa del objetivo
  enqueueSelect(opts.locked ?? [{ id: 'membership-1' }]) // relectura bloqueada
  enqueueSelect(
    opts.guildGone ? [] : [{ ownerId: opts.currentOwnerId ?? OWNER }],
  ) // owner estructural
  enqueueUpdate(opts.updated ?? [{ id: 'membership-1' }])
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('updateGuildMemberRoleHandler — comprobación previa', () => {
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
    enqueueRoleChangeFlow()

    await expect(
      updateGuildMemberRoleHandler(payload(MEMBER, 'admin'), OWNER),
    ).resolves.toEqual({ userId: MEMBER, role: 'admin' })
  })

  it('el owner degrada a un Officer a Member', async () => {
    setupGuild()
    enqueueRoleChangeFlow()

    await expect(
      updateGuildMemberRoleHandler(payload('u-admin', 'member'), OWNER),
    ).resolves.toEqual({ userId: 'u-admin', role: 'member' })
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
    enqueueSelect([]) // la lectura previa no encuentra al objetivo

    await expect(
      updateGuildMemberRoleHandler(payload('u-ghost'), OWNER),
    ).rejects.toThrow('Not Found: member not found in this guild')
    expect(getDbCalls().filter((call) => call.op !== 'select')).toHaveLength(0)
  })
})

describe('updateGuildMemberRoleHandler — reverificación TOCTOU bajo bloqueo', () => {
  it('relee al objetivo CON bloqueo y el owner SIN bloqueo, antes de escribir', async () => {
    setupGuild()
    enqueueRoleChangeFlow()

    await updateGuildMemberRoleHandler(payload(MEMBER, 'admin'), OWNER)

    const calls = getDbCalls()
    expect(calls).toHaveLength(4)
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
    // invertir el orden guilds → guild_members de transfer-guild-ownership.
    expect(calls[2]).toMatchObject({
      op: 'select',
      table: guilds,
      locked: false,
    })
    expect(calls[3]).toMatchObject({
      op: 'update',
      table: guildMembers,
      set: { role: 'admin' },
      returning: true,
    })
  })

  it('aborta con Conflict si una transferencia hizo owner al objetivo', async () => {
    setupGuild()
    enqueueRoleChangeFlow({
      // La transferencia concurrente confirmó antes de que tomáramos el
      // bloqueo: escribir aquí dejaría al nuevo owner con role = 'member'.
      currentOwnerId: MEMBER,
    })

    await expect(
      updateGuildMemberRoleHandler(payload(MEMBER, 'member'), OWNER),
    ).rejects.toThrow(
      'Conflict: guild ownership changed — please refresh and try again',
    )
    expect(getDbCalls().filter((call) => call.op === 'update')).toHaveLength(0)
  })

  it('aborta con Conflict si el solicitante dejó de ser el owner', async () => {
    setupGuild()
    enqueueRoleChangeFlow({ currentOwnerId: 'u-new-owner' })

    await expect(
      updateGuildMemberRoleHandler(payload(MEMBER, 'admin'), OWNER),
    ).rejects.toThrow(
      'Conflict: guild ownership changed — please refresh and try again',
    )
    expect(getDbCalls().filter((call) => call.op === 'update')).toHaveLength(0)
  })

  it('aborta con Conflict si el objetivo salió del guild antes del bloqueo', async () => {
    setupGuild()
    enqueueRoleChangeFlow({ locked: [] })

    await expect(
      updateGuildMemberRoleHandler(payload(MEMBER, 'admin'), OWNER),
    ).rejects.toThrow(
      'Conflict: this member is no longer in the guild — please refresh and try again',
    )
    expect(getDbCalls().filter((call) => call.op === 'update')).toHaveLength(0)
  })

  it('aborta con Conflict si el UPDATE no afecta a ninguna fila', async () => {
    setupGuild()
    enqueueRoleChangeFlow({ updated: [] })

    await expect(
      updateGuildMemberRoleHandler(payload(MEMBER, 'admin'), OWNER),
    ).rejects.toThrow(
      'Conflict: this member is no longer in the guild — please refresh and try again',
    )
  })

  it('aborta con un Conflict propio si el guild se borró antes del bloqueo', async () => {
    setupGuild()
    enqueueRoleChangeFlow({ guildGone: true })

    await expect(
      updateGuildMemberRoleHandler(payload(MEMBER, 'admin'), OWNER),
    ).rejects.toThrow(
      'Conflict: this guild no longer exists — please refresh and try again',
    )
    expect(getDbCalls().filter((call) => call.op !== 'select')).toHaveLength(0)
  })
})
