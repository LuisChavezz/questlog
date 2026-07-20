// @vitest-environment node
// Tests de la lógica de removeGuildMember sin el RPC de TanStack Start: se prueba
// `removeGuildMemberHandler` directamente, con `#/db` mockeado por el stub
// encadenable y `resolveGuildBySlugOrThrow` mockeado (su acceso a BD se testea
// aparte). Cubre los gates previos (sí mismo / owner / membresía), la jerarquía
// de `canRemoveMember`, la reverificación TOCTOU dentro de la transacción y la
// limpieza en cascada de asignado/supervisor.
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GuildRole } from '#/db/schema'
import { guildMembers, guilds, quests } from '#/db/schema'
import {
  enqueueDelete,
  enqueueSelect,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import { removeGuildMemberHandler } from './remove-guild-member.handler'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('./resolve-guild-or-throw', () => ({
  resolveGuildBySlugOrThrow: vi.fn(),
}))

const SLUG = 'my-guild'
const GUILD = 'guild-1'
const OWNER = 'u-owner' // Guild Master — dueño estructural (guilds.owner_id)
const ADMIN = 'u-admin' // Officer
const MEMBER = 'u-member'

function payload(userId: string) {
  return { slug: SLUG, userId }
}

function member(userId: string, role: GuildRole) {
  return { userId, role }
}

// Fija el guild resuelto (id + dueño estructural) para el caso bajo prueba.
function setupGuild(ownerId = OWNER) {
  vi.mocked(resolveGuildBySlugOrThrow).mockResolvedValue({
    id: GUILD,
    ownerId,
  })
}

/**
 * Encola las lecturas/escrituras de una expulsión completa. Por defecto el
 * estado bloqueado es idéntico al previo (sin carrera) y el borrado afecta a una
 * fila; cada override simula un cambio concurrente en ese punto exacto.
 */
function enqueueRemovalFlow(opts: {
  memberships: { userId: string; role: GuildRole }[]
  locked?: { userId: string; role: GuildRole }[]
  currentOwnerId?: string
  deleted?: { id: string }[]
}) {
  enqueueSelect(opts.memberships) // lectura previa de membresías
  enqueueSelect(opts.locked ?? opts.memberships) // relectura bloqueada
  enqueueSelect([{ ownerId: opts.currentOwnerId ?? OWNER }]) // owner estructural
  enqueueDelete(opts.deleted ?? [{ id: 'membership-1' }]) // borrado de membresía
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('removeGuildMemberHandler — gates previos a la transacción', () => {
  it('propaga Not Found cuando el guild no existe (antes de cualquier permiso)', async () => {
    vi.mocked(resolveGuildBySlugOrThrow).mockRejectedValue(
      new Error('Not Found: guild not found'),
    )

    await expect(
      removeGuildMemberHandler(payload(MEMBER), OWNER),
    ).rejects.toThrow('Not Found: guild not found')
  })

  it('lanza Forbidden cuando alguien intenta expulsarse a sí mismo', async () => {
    setupGuild()

    await expect(
      removeGuildMemberHandler(payload(ADMIN), ADMIN),
    ).rejects.toThrow('Forbidden: you cannot remove yourself from the guild')
  })

  it('lanza Forbidden cuando el objetivo es el dueño estructural del guild', async () => {
    setupGuild()

    await expect(
      removeGuildMemberHandler(payload(OWNER), ADMIN),
    ).rejects.toThrow('Forbidden: the guild owner cannot be removed')
  })

  it('lanza Forbidden cuando el solicitante no es miembro del guild', async () => {
    setupGuild()
    enqueueSelect([member(MEMBER, 'member')]) // solo aparece el objetivo

    await expect(
      removeGuildMemberHandler(payload(MEMBER), 'u-stranger'),
    ).rejects.toThrow('Forbidden: you are not a member of this guild')
  })

  it('lanza Not Found cuando el objetivo no es miembro del guild', async () => {
    setupGuild()
    enqueueSelect([member(OWNER, 'owner')]) // solo aparece el solicitante

    await expect(
      removeGuildMemberHandler(payload('u-ghost'), OWNER),
    ).rejects.toThrow('Not Found: member not found in this guild')
  })
})

describe('removeGuildMemberHandler — jerarquía de roles', () => {
  it('el Guild Master puede expulsar a un Member', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(OWNER, 'owner'), member(MEMBER, 'member')],
    })

    await expect(
      removeGuildMemberHandler(payload(MEMBER), OWNER),
    ).resolves.toEqual({ userId: MEMBER })
  })

  it('el Guild Master puede expulsar a un Officer', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(OWNER, 'owner'), member(ADMIN, 'admin')],
    })

    await expect(
      removeGuildMemberHandler(payload(ADMIN), OWNER),
    ).resolves.toEqual({ userId: ADMIN })
  })

  it('un Officer puede expulsar a un Member (rango estrictamente inferior)', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(ADMIN, 'admin'), member(MEMBER, 'member')],
    })

    await expect(
      removeGuildMemberHandler(payload(MEMBER), ADMIN),
    ).resolves.toEqual({ userId: MEMBER })
  })

  it('un Officer NO puede expulsar a otro Officer (mismo rango)', async () => {
    setupGuild()
    enqueueSelect([member(ADMIN, 'admin'), member('u-admin-2', 'admin')])

    await expect(
      removeGuildMemberHandler(payload('u-admin-2'), ADMIN),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to remove this member',
    )
  })

  it('un Officer NO puede expulsar al Guild Master — el gate del owner manda primero', async () => {
    setupGuild()

    // No llega siquiera a leer membresías: el gate estructural corta antes, y
    // por eso el mensaje es el del owner y no el de jerarquía.
    await expect(
      removeGuildMemberHandler(payload(OWNER), ADMIN),
    ).rejects.toThrow('Forbidden: the guild owner cannot be removed')
    expect(getDbCalls()).toHaveLength(0)
  })

  it('un Member no puede expulsar a otro Member', async () => {
    setupGuild()
    enqueueSelect([member(MEMBER, 'member'), member('u-member-2', 'member')])

    await expect(
      removeGuildMemberHandler(payload('u-member-2'), MEMBER),
    ).rejects.toThrow(
      'Forbidden: you do not have permission to remove this member',
    )
  })
})

describe('removeGuildMemberHandler — reverificación TOCTOU bajo bloqueo', () => {
  it('relee las membresías CON bloqueo y confirma el borrado con returning', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(OWNER, 'owner'), member(MEMBER, 'member')],
    })

    await removeGuildMemberHandler(payload(MEMBER), OWNER)

    const calls = getDbCalls()
    // 1.ª lectura sin bloqueo (fast-path) y 2.ª CON bloqueo, ambas sobre
    // guild_members: la ruta de reverificación se ejecutó de verdad.
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
    // Relectura del owner estructural, deliberadamente SIN bloqueo (MVCC) para
    // no invertir el orden de locks respecto a transfer-guild-ownership.
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

  it('aborta con Conflict si el objetivo pasó a ser owner durante la carrera', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(OWNER, 'owner'), member(MEMBER, 'member')],
      // Una transferencia concurrente confirmó: el objetivo ya es el owner.
      currentOwnerId: MEMBER,
    })

    await expect(
      removeGuildMemberHandler(payload(MEMBER), OWNER),
    ).rejects.toThrow(
      'Conflict: this member is now the guild owner — please refresh and try again',
    )
  })

  it('aborta con Conflict si el solicitante perdió el rango durante la carrera', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(ADMIN, 'admin'), member(MEMBER, 'member')],
      // El Officer fue degradado a Member entre el check previo y el bloqueo.
      locked: [member(ADMIN, 'member'), member(MEMBER, 'member')],
    })

    await expect(
      removeGuildMemberHandler(payload(MEMBER), ADMIN),
    ).rejects.toThrow(
      'Conflict: member permissions changed — please refresh and try again',
    )
  })

  it('lanza Forbidden si el solicitante dejó de ser miembro durante la carrera', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(ADMIN, 'admin'), member(MEMBER, 'member')],
      locked: [member(MEMBER, 'member')], // el solicitante ya no está
    })

    await expect(
      removeGuildMemberHandler(payload(MEMBER), ADMIN),
    ).rejects.toThrow('Forbidden: you are not a member of this guild')
  })

  it('lanza Not Found si el objetivo dejó de ser miembro durante la carrera', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(OWNER, 'owner'), member(MEMBER, 'member')],
      locked: [member(OWNER, 'owner')], // el objetivo ya no está
    })

    await expect(
      removeGuildMemberHandler(payload(MEMBER), OWNER),
    ).rejects.toThrow('Not Found: member not found in this guild')
  })

  it('lanza Not Found si el borrado no afecta a ninguna fila', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(OWNER, 'owner'), member(MEMBER, 'member')],
      deleted: [], // returning() vacío: la fila desapareció al escribir
    })

    await expect(
      removeGuildMemberHandler(payload(MEMBER), OWNER),
    ).rejects.toThrow('Not Found: member not found in this guild')
  })
})

describe('removeGuildMemberHandler — limpieza en cascada de quests', () => {
  it('limpia asignado y supervisor del expulsado en la misma transacción', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(OWNER, 'owner'), member(MEMBER, 'member')],
    })

    await removeGuildMemberHandler(payload(MEMBER), OWNER)

    // Las dos limpiezas van DESPUÉS del borrado de la membresía y sobre quests,
    // no sobre guild_members: no puede existir un instante con la membresía
    // borrada y la referencia aún viva.
    const updates = getDbCalls().filter((call) => call.op === 'update')
    expect(updates).toHaveLength(2)
    expect(updates[0]).toMatchObject({
      table: quests,
      set: { assigneeId: null },
    })
    expect(updates[1]).toMatchObject({
      table: quests,
      set: { supervisorId: null },
    })
  })

  it('no limpia nada si la expulsión aborta antes del borrado', async () => {
    setupGuild()
    enqueueRemovalFlow({
      memberships: [member(OWNER, 'owner'), member(MEMBER, 'member')],
      currentOwnerId: MEMBER, // aborta con Conflict antes de borrar
    })

    await expect(
      removeGuildMemberHandler(payload(MEMBER), OWNER),
    ).rejects.toThrow('Conflict')

    expect(getDbCalls().filter((call) => call.op === 'update')).toHaveLength(0)
    expect(getDbCalls().filter((call) => call.op === 'delete')).toHaveLength(0)
  })
})
