// Deriva el `QuestsColumnsGuildContext` (miembros + reasignación + predicados de
// permiso por quest) a partir del contexto de guild de una tabla y el callback de
// actualización. Fuente ÚNICA de este ensamblado, compartida por la tabla de
// quests de un guild y por el host del drawer en el Overview — así la lógica de
// permisos (misma de `role-labels` que el servidor) no se reimplementa dos veces.
import { useCallback, useMemo } from 'react'

import type { Quest } from '#/db/schema'
import {
  canManageGuildQuest,
  canUpdateGuildQuestStatus,
} from '#/features/guilds/role-labels'
import type { GuildMemberViewer } from '#/features/guilds/role-labels'
import type { UpdateQuestValues } from '../schemas/quest-schemas'
import type { QuestsColumnsGuildContext } from '../components/quests-columns'
import type { QuestsTableGuildContext } from '../components/quests-table'

export function useQuestsColumnsGuildContext(
  guildContext: QuestsTableGuildContext | undefined,
  updateQuest: (data: UpdateQuestValues) => void,
): QuestsColumnsGuildContext | undefined {
  const guildMembers = guildContext?.members
  const guildCurrentUserId = guildContext?.currentUserId
  const guildCurrentUserRole = guildContext?.currentUserRole
  const guildOwnerId = guildContext?.guildOwnerId

  // Reasignar asignado/supervisor es solo otra edición de campo: se enruta por el
  // mismo `updateQuest` (misma caché optimista y misma invalidación) en vez de un
  // hook aparte que reimplemente el patrón.
  const updateAssignment = useCallback(
    (input: {
      id: string
      field: 'assigneeId' | 'supervisorId'
      userId: string | null
    }) => {
      updateQuest({ id: input.id, [input.field]: input.userId })
    },
    [updateQuest],
  )

  // Predicados de permiso derivados del contexto de guild — misma lógica de dos
  // ejes que el servidor (role-labels). El rol del creador de cada quest se
  // resuelve contra los miembros del guild.
  const guildAuth = useMemo(() => {
    if (
      !guildMembers ||
      !guildCurrentUserId ||
      !guildCurrentUserRole ||
      !guildOwnerId
    ) {
      return null
    }

    const viewer: GuildMemberViewer = {
      viewerId: guildCurrentUserId,
      viewerRole: guildCurrentUserRole,
      ownerId: guildOwnerId,
    }
    const roleByUserId = new Map(guildMembers.map((m) => [m.userId, m.role]))
    const targetOf = (quest: Quest) => ({
      creatorId: quest.ownerId,
      creatorRole: roleByUserId.get(quest.ownerId) ?? null,
      assigneeId: quest.assigneeId,
      supervisorId: quest.supervisorId,
    })

    return {
      canManageQuest: (quest: Quest) =>
        canManageGuildQuest(viewer, targetOf(quest)),
      canUpdateQuestStatus: (quest: Quest) =>
        canUpdateGuildQuestStatus(viewer, targetOf(quest)),
    }
  }, [guildMembers, guildCurrentUserId, guildCurrentUserRole, guildOwnerId])

  return useMemo(
    () =>
      guildMembers && guildAuth
        ? {
            members: guildMembers,
            onAssignmentChange: updateAssignment,
            canManageQuest: guildAuth.canManageQuest,
            canUpdateQuestStatus: guildAuth.canUpdateQuestStatus,
          }
        : undefined,
    [guildMembers, guildAuth, updateAssignment],
  )
}
