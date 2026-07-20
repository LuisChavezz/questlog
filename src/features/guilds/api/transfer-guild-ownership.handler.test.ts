// @vitest-environment node
// Tests de la lógica de transferGuildOwnership sin el RPC de TanStack Start: se
// prueba `transferGuildOwnershipHandler` directamente, con `#/db` mockeado por el
// stub encadenable y `resolveGuildBySlugOrThrow` mockeado (su acceso a BD se
// testea aparte). Cubre los gates previos, la reverificación de propiedad contra
// la fila BLOQUEADA —la carrera exacta que esta función existe para cerrar— y
// que las tres escrituras del invariante se apliquen juntas y en orden.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { guildMembers, guilds } from '#/db/schema'
import {
  enqueueSelect,
  enqueueUpdate,
  getDbCalls,
  resetDbStub,
} from '#/test/drizzle-stub'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'
import { transferGuildOwnershipHandler } from './transfer-guild-ownership.handler'

vi.mock('#/db', async () => ({
  db: (await import('#/test/drizzle-stub')).dbStub,
}))
vi.mock('./resolve-guild-or-throw', () => ({
  resolveGuildBySlugOrThrow: vi.fn(),
}))

const SLUG = 'my-guild'
const GUILD = 'guild-1'
const OWNER = 'u-owner' // dueño estructural actual (guilds.owner_id)
const NEW_OWNER = 'u-new-owner'

function payload(newOwnerUserId = NEW_OWNER) {
  return { slug: SLUG, newOwnerUserId }
}

// Fija el guild resuelto (id + dueño estructural) para el caso bajo prueba.
function setupGuild(ownerId = OWNER) {
  vi.mocked(resolveGuildBySlugOrThrow).mockResolvedValue({
    id: GUILD,
    ownerId,
  })
}

/**
 * Encola las lecturas/escrituras de una transferencia completa. Por defecto la
 * fila bloqueada coincide con la previa (sin carrera) y las dos actualizaciones
 * de rol afectan a una fila; cada override simula un cambio concurrente en ese
 * punto exacto.
 */
function enqueueTransferFlow(
  opts: {
    targetMembership?: { id: string }[]
    lockedGuild?: { id: string; ownerId: string }[]
    demoted?: { id: string }[]
    promoted?: { id: string }[]
  } = {},
) {
  enqueueSelect(opts.targetMembership ?? [{ id: 'membership-new-owner' }])
  enqueueSelect(opts.lockedGuild ?? [{ id: GUILD, ownerId: OWNER }])
  enqueueUpdate([]) // guilds.owner_id — no usa returning()
  enqueueUpdate(opts.demoted ?? [{ id: 'membership-old-owner' }])
  enqueueUpdate(opts.promoted ?? [{ id: 'membership-new-owner' }])
}

afterEach(() => {
  resetDbStub()
  vi.clearAllMocks()
})

describe('transferGuildOwnershipHandler — gates previos a la transacción', () => {
  it('propaga Not Found cuando el guild no existe', async () => {
    vi.mocked(resolveGuildBySlugOrThrow).mockRejectedValue(
      new Error('Not Found: guild not found'),
    )

    await expect(
      transferGuildOwnershipHandler(payload(), OWNER),
    ).rejects.toThrow('Not Found: guild not found')
  })

  it('lanza Forbidden cuando quien transfiere no es el owner actual', async () => {
    setupGuild()

    await expect(
      transferGuildOwnershipHandler(payload(), 'u-admin'),
    ).rejects.toThrow(
      'Forbidden: only the current owner can transfer ownership',
    )
  })

  it('lanza Bad Request cuando el owner se transfiere a sí mismo', async () => {
    setupGuild()

    await expect(
      transferGuildOwnershipHandler(payload(OWNER), OWNER),
    ).rejects.toThrow('Bad Request: you are already the owner of this guild')
  })

  it('lanza Bad Request cuando el objetivo no es miembro del guild', async () => {
    setupGuild()
    enqueueSelect([]) // no hay fila de membresía para el objetivo

    await expect(
      transferGuildOwnershipHandler(payload(), OWNER),
    ).rejects.toThrow(
      'Bad Request: the new owner must already be a member of this guild',
    )
  })
})

describe('transferGuildOwnershipHandler — reverificación bajo bloqueo de fila', () => {
  it('transfiere cuando el owner sigue siéndolo en la fila bloqueada', async () => {
    setupGuild()
    enqueueTransferFlow()

    await expect(
      transferGuildOwnershipHandler(payload(), OWNER),
    ).resolves.toEqual({
      guildId: GUILD,
      previousOwnerUserId: OWNER,
      newOwnerUserId: NEW_OWNER,
    })
  })

  it('relee el guild CON bloqueo antes de escribir', async () => {
    setupGuild()
    enqueueTransferFlow()

    await transferGuildOwnershipHandler(payload(), OWNER)

    const calls = getDbCalls()
    // La comprobación previa lee guild_members sin bloqueo; la autoritativa
    // relee guilds CON bloqueo, y solo después vienen las escrituras.
    expect(calls[0]).toMatchObject({
      op: 'select',
      table: guildMembers,
      locked: false,
    })
    expect(calls[1]).toMatchObject({
      op: 'select',
      table: guilds,
      locked: true,
    })
    expect(calls[2].op).toBe('update')
  })

  it('aborta con Conflict si la propiedad ya cambió en la fila bloqueada, SIN escribir', async () => {
    setupGuild() // el check previo pasa: para el snapshot, OWNER sigue siendo owner
    enqueueTransferFlow({
      // …pero al tomar el bloqueo, otra transferencia ya había confirmado.
      lockedGuild: [{ id: GUILD, ownerId: 'u-someone-else' }],
    })

    await expect(
      transferGuildOwnershipHandler(payload(), OWNER),
    ).rejects.toThrow(
      'Conflict: ownership has already changed — please refresh and try again',
    )

    // Lo esencial de esta función: la lectura bloqueada GATEA las escrituras.
    // Si alguna llegara a ejecutarse, el guild quedaría con dos owners.
    expect(getDbCalls().filter((call) => call.op === 'update')).toHaveLength(0)
  })

  it('aborta con Conflict si la fila del guild desapareció al bloquear', async () => {
    setupGuild()
    enqueueTransferFlow({ lockedGuild: [] })

    await expect(
      transferGuildOwnershipHandler(payload(), OWNER),
    ).rejects.toThrow(
      'Conflict: the guild changed while transferring — please refresh and try again',
    )
    expect(getDbCalls().filter((call) => call.op === 'update')).toHaveLength(0)
  })

  it('aborta con Conflict si la membresía del owner saliente ya no existe', async () => {
    setupGuild()
    enqueueTransferFlow({ demoted: [] })

    await expect(
      transferGuildOwnershipHandler(payload(), OWNER),
    ).rejects.toThrow(
      'Conflict: your membership changed while transferring — please refresh and try again',
    )
  })

  it('aborta con Conflict si el nuevo owner dejó de ser miembro al escribir', async () => {
    setupGuild()
    enqueueTransferFlow({ promoted: [] })

    await expect(
      transferGuildOwnershipHandler(payload(), OWNER),
    ).rejects.toThrow(
      'Conflict: the new owner is no longer a member of this guild — please refresh and try again',
    )
  })
})

describe('transferGuildOwnershipHandler — las tres escrituras del invariante', () => {
  it('actualiza guilds.owner_id y ambos roles, en orden y en la misma transacción', async () => {
    setupGuild()
    enqueueTransferFlow()

    await transferGuildOwnershipHandler(payload(), OWNER)

    const updates = getDbCalls().filter((call) => call.op === 'update')
    expect(updates).toHaveLength(3)

    // 1. El dueño estructural pasa al nuevo owner.
    expect(updates[0]).toMatchObject({
      table: guilds,
      set: { ownerId: NEW_OWNER },
    })
    // 2. El owner saliente baja a member — con returning() para confirmar que
    // su fila existía (owner sin membresía sería una inconsistencia).
    expect(updates[1]).toMatchObject({
      table: guildMembers,
      set: { role: 'member' },
      returning: true,
    })
    // 3. El objetivo sube a owner — también con returning().
    expect(updates[2]).toMatchObject({
      table: guildMembers,
      set: { role: 'owner' },
      returning: true,
    })
  })
})
