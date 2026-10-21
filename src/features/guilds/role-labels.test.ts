// @vitest-environment node
// Tests de los predicados de permisos de quests de guild. Son la fuente única
// de verdad que comparten la UI y el servidor, así que aquí se fija la regla
// pura, sin handlers ni stubs de BD: en especial el rango efectivo del creador
// (owner estructural aunque su rol haya derivado; ex-miembro como member).
import { describe, expect, it } from 'vitest'

import type { GuildRole } from '#/db/schema'
import {
  canDeleteGuildQuestComment,
  canEditGuildQuestComment,
  canManageGuildQuest,
  canUpdateGuildQuestStatus,
} from './role-labels'
import type {
  GuildMemberViewer,
  GuildQuestPermissionTarget,
} from './role-labels'

const OWNER = 'u-owner' // Guild Master — dueño estructural (guilds.owner_id)
const ADMIN = 'u-admin' // Officer
const ADMIN_2 = 'u-admin-2'
const MEMBER = 'u-member'
const MEMBER_2 = 'u-member-2'
const EX_MEMBER = 'u-ex-member' // creador que ya no pertenece al guild

function viewer(viewerId: string, viewerRole: GuildRole): GuildMemberViewer {
  return { viewerId, viewerRole, ownerId: OWNER }
}

function quest(
  creatorId: string,
  creatorRole: GuildRole | null,
  overrides: Partial<GuildQuestPermissionTarget> = {},
): GuildQuestPermissionTarget {
  return {
    creatorId,
    creatorRole,
    assigneeId: null,
    supervisorId: null,
    ...overrides,
  }
}

describe('canManageGuildQuest — casos existentes', () => {
  it('el creador siempre gestiona su quest, sea cual sea su rol', () => {
    expect(
      canManageGuildQuest(viewer(MEMBER, 'member'), quest(MEMBER, 'member')),
    ).toBe(true)
  })

  it('el Guild Master gestiona cualquier quest del guild', () => {
    expect(
      canManageGuildQuest(viewer(OWNER, 'owner'), quest(ADMIN, 'admin')),
    ).toBe(true)
    expect(
      canManageGuildQuest(viewer(OWNER, 'owner'), quest(MEMBER, 'member')),
    ).toBe(true)
  })

  it('un Officer gestiona quests creadas por un Member', () => {
    expect(
      canManageGuildQuest(viewer(ADMIN, 'admin'), quest(MEMBER, 'member')),
    ).toBe(true)
  })

  it('un Officer NO gestiona quests creadas por otro Officer (mismo rango)', () => {
    expect(
      canManageGuildQuest(viewer(ADMIN, 'admin'), quest(ADMIN_2, 'admin')),
    ).toBe(false)
  })

  it('un Officer NO gestiona quests del Guild Master', () => {
    expect(
      canManageGuildQuest(viewer(ADMIN, 'admin'), quest(OWNER, 'owner')),
    ).toBe(false)
  })

  it('un Member no gestiona quests ajenas', () => {
    expect(
      canManageGuildQuest(viewer(MEMBER, 'member'), quest(MEMBER_2, 'member')),
    ).toBe(false)
  })
})

describe('canManageGuildQuest — rango efectivo del creador', () => {
  it('un creador que es el owner estructural cuenta como owner aunque su rol haya derivado', () => {
    // guild_members.role dice 'member' (drift tras una carrera con una
    // transferencia), pero guilds.owner_id lo señala como Guild Master: un
    // Officer no debe poder gestionar sus quests.
    expect(
      canManageGuildQuest(viewer(ADMIN, 'admin'), quest(OWNER, 'member')),
    ).toBe(false)
    expect(
      canManageGuildQuest(viewer(ADMIN, 'admin'), quest(OWNER, 'admin')),
    ).toBe(false)
  })

  it('un Officer gestiona quests de un creador que ya no es miembro', () => {
    expect(
      canManageGuildQuest(viewer(ADMIN, 'admin'), quest(EX_MEMBER, null)),
    ).toBe(true)
  })

  it('el Guild Master gestiona quests de un creador que ya no es miembro', () => {
    expect(
      canManageGuildQuest(viewer(OWNER, 'owner'), quest(EX_MEMBER, null)),
    ).toBe(true)
  })

  it('un Member sigue sin gestionar quests de un ex-miembro', () => {
    expect(
      canManageGuildQuest(viewer(MEMBER, 'member'), quest(EX_MEMBER, null)),
    ).toBe(false)
  })

  it('un ex-Officer que ya no es miembro cuenta como member, no como admin', () => {
    // El rol que tuvo no importa: sin fila de membresía, `creatorRole` llega
    // null y el rango efectivo es el más bajo.
    expect(
      canManageGuildQuest(viewer(ADMIN_2, 'admin'), quest(EX_MEMBER, null)),
    ).toBe(true)
  })
})

describe('canUpdateGuildQuestStatus', () => {
  it('asignado y supervisor solo cambian estado, sin gestión completa', () => {
    const target = quest(MEMBER_2, 'member', {
      assigneeId: MEMBER,
      supervisorId: ADMIN_2,
    })

    expect(canUpdateGuildQuestStatus(viewer(MEMBER, 'member'), target)).toBe(
      true,
    )
    expect(canManageGuildQuest(viewer(MEMBER, 'member'), target)).toBe(false)
    expect(canUpdateGuildQuestStatus(viewer(ADMIN_2, 'admin'), target)).toBe(
      true,
    )
  })

  it('hereda la gestión del Officer sobre quests de un ex-miembro', () => {
    expect(
      canUpdateGuildQuestStatus(viewer(ADMIN, 'admin'), quest(EX_MEMBER, null)),
    ).toBe(true)
  })
})

// ─── Comentarios ──────────────────────────────────────────────────────────────

describe('canEditGuildQuestComment', () => {
  it('el autor edita su propio comentario, sea cual sea su rol', () => {
    expect(
      canEditGuildQuestComment(viewer(MEMBER, 'member'), { authorId: MEMBER }),
    ).toBe(true)
    expect(
      canEditGuildQuestComment(viewer(OWNER, 'owner'), { authorId: OWNER }),
    ).toBe(true)
  })

  it('nadie edita el comentario de otro — tampoco el Guild Master ni un Officer', () => {
    const target = { authorId: MEMBER }

    expect(canEditGuildQuestComment(viewer(OWNER, 'owner'), target)).toBe(false)
    expect(canEditGuildQuestComment(viewer(ADMIN, 'admin'), target)).toBe(false)
    expect(canEditGuildQuestComment(viewer(MEMBER_2, 'member'), target)).toBe(
      false,
    )
  })

  it('un comentario huérfano (autor borrado) no lo edita nadie', () => {
    const orphan = { authorId: null }

    expect(canEditGuildQuestComment(viewer(OWNER, 'owner'), orphan)).toBe(false)
    expect(canEditGuildQuestComment(viewer(MEMBER, 'member'), orphan)).toBe(
      false,
    )
  })
})

describe('canDeleteGuildQuestComment', () => {
  it('el autor borra su propio comentario', () => {
    expect(
      canDeleteGuildQuestComment(viewer(MEMBER, 'member'), {
        authorId: MEMBER,
      }),
    ).toBe(true)
  })

  it('el Guild Master borra comentarios ajenos', () => {
    expect(
      canDeleteGuildQuestComment(viewer(OWNER, 'owner'), { authorId: MEMBER }),
    ).toBe(true)
  })

  it('un Officer NO borra comentarios ajenos, ni siquiera de un Member', () => {
    expect(
      canDeleteGuildQuestComment(viewer(ADMIN, 'admin'), { authorId: MEMBER }),
    ).toBe(false)
  })

  it('un Member no borra comentarios ajenos', () => {
    expect(
      canDeleteGuildQuestComment(viewer(MEMBER_2, 'member'), {
        authorId: MEMBER,
      }),
    ).toBe(false)
  })

  it('un huérfano solo lo borra el Guild Master', () => {
    const orphan = { authorId: null }

    expect(canDeleteGuildQuestComment(viewer(OWNER, 'owner'), orphan)).toBe(
      true,
    )
    expect(canDeleteGuildQuestComment(viewer(ADMIN, 'admin'), orphan)).toBe(
      false,
    )
    expect(canDeleteGuildQuestComment(viewer(MEMBER, 'member'), orphan)).toBe(
      false,
    )
  })

  it('el Guild Master se decide por la propiedad estructural, no por el rol', () => {
    // Un rol `owner` derivado en guild_members sin ser guilds.owner_id no basta.
    expect(
      canDeleteGuildQuestComment(
        { viewerId: ADMIN, ownerId: OWNER },
        { authorId: MEMBER },
      ),
    ).toBe(false)
  })
})
