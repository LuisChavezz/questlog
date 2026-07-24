// Lógica de negocio de la actualización de una quest, separada del envoltorio RPC
// (update-quest.ts). El envoltorio solo resuelve la sesión y delega aquí; esta
// función recibe el `userId` ya autenticado y el `data` ya validado, así que es
// invocable directamente en tests con `#/db` mockeado — sin depender del
// transform del plugin de TanStack Start, que no está activo bajo Vitest y hace
// que un server fn llamado directo resuelva a `undefined`.
//
// El comportamiento (checks de autorización, mensajes de error, transacción con
// bloqueo y reverificación) es idéntico al que tenía inline en el handler.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildQuestActivityLog, quests } from '#/db/schema'
import type { NewGuildQuestActivityLog } from '#/db/schema'
import {
  canManageGuildQuest,
  canUpdateGuildQuestStatus,
} from '#/features/guilds/role-labels'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import { parseQuestDueDateValue } from '../schemas/quest-schemas'
import type { UpdateQuestValues } from '../schemas/quest-schemas'
import { computeGuildQuestFieldChanges } from './guild-quest-activity-log'

export async function updateQuestHandler(
  data: UpdateQuestValues,
  userId: string,
) {
  // Construir el payload de actualización con los campos provistos
  const updatePayload: Record<string, unknown> = {}

  if (data.title !== undefined) {
    updatePayload.title = data.title
  }

  if (data.description !== undefined) {
    updatePayload.description = data.description.trim() || null
  }

  if (data.status !== undefined) {
    updatePayload.status = data.status
    // Registrar la fecha de finalización cuando la quest se marca como completada
    updatePayload.completedAt = data.status === 'done' ? new Date() : null
  }

  if (data.priority !== undefined) {
    updatePayload.priority = data.priority
  }

  if (data.tags !== undefined) {
    updatePayload.tags = data.tags
  }

  if (data.dueDate !== undefined) {
    updatePayload.dueDate = parseQuestDueDateValue(data.dueDate)
  }

  // Autorización: se necesita conocer el guild, el creador y las asignaciones
  // de la quest, así que se lee la fila SIN filtrar por owner (la autoridad
  // pasa a los predicados compartidos, no a la cláusula WHERE).
  const existingRows = await db
    .select({
      ownerId: quests.ownerId,
      guildId: quests.guildId,
      assigneeId: quests.assigneeId,
      supervisorId: quests.supervisorId,
    })
    .from(quests)
    .where(eq(quests.id, data.id))
    .limit(1)

  if (existingRows.length === 0) {
    throw new Error('Not Found: quest not found')
  }

  const existing = existingRows[0]

  // ¿Toca algún campo de gestión (eje 1) o solo el estado (eje 2)?
  const touchesManagementField =
    data.title !== undefined ||
    data.description !== undefined ||
    data.priority !== undefined ||
    data.tags !== undefined ||
    data.dueDate !== undefined ||
    data.assigneeId !== undefined ||
    data.supervisorId !== undefined

  if (existing.guildId) {
    // Quest de guild — modelo de dos ejes. El contexto de autorización (viewer
    // + roles) se resuelve con el helper compartido por create/update/delete.
    const { viewer, roleByUserId } = await resolveGuildQuestAuth(
      existing.guildId,
      userId,
      [existing.ownerId, data.assigneeId, data.supervisorId],
    )
    const questTarget = {
      creatorId: existing.ownerId,
      creatorRole: roleByUserId.get(existing.ownerId) ?? null,
      assigneeId: existing.assigneeId,
      supervisorId: existing.supervisorId,
    }

    // Cualquier campo de gestión exige el eje 1; si solo cambia el estado,
    // basta el eje 2 (que incluye a asignado y supervisor).
    if (touchesManagementField) {
      if (!canManageGuildQuest(viewer, questTarget)) {
        throw new Error(
          'Forbidden: you do not have permission to modify this quest',
        )
      }
    } else if (data.status !== undefined) {
      if (!canUpdateGuildQuestStatus(viewer, questTarget)) {
        throw new Error(
          'Forbidden: you can only update the status of this quest',
        )
      }
    }

    // El nuevo asignado/supervisor debe pertenecer al guild. `null` limpia.
    if (data.assigneeId && !roleByUserId.has(data.assigneeId)) {
      throw new Error('Assignee must be a member of the guild')
    }
    if (data.supervisorId && !roleByUserId.has(data.supervisorId)) {
      throw new Error('Supervisor must be a member of the guild')
    }
    if (data.assigneeId !== undefined) {
      updatePayload.assigneeId = data.assigneeId
    }
    if (data.supervisorId !== undefined) {
      updatePayload.supervisorId = data.supervisorId
    }
  } else {
    // Quest personal — solo el creador puede modificarla y no admite
    // asignado/supervisor (un id los rechaza; `null` se acepta como no-op).
    if (existing.ownerId !== userId) {
      throw new Error(
        'Forbidden: you do not have permission to modify this quest',
      )
    }
    if (data.assigneeId || data.supervisorId) {
      throw new Error('Personal quests cannot have an assignee or supervisor')
    }
    if (data.assigneeId !== undefined) {
      updatePayload.assigneeId = data.assigneeId
    }
    if (data.supervisorId !== undefined) {
      updatePayload.supervisorId = data.supervisorId
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error('No fields to update')
  }

  // La autorización de arriba se resolvió sobre una lectura ya soltada: entre
  // ella y este UPDATE, la quest pudo reasignarse, el observador perder su rol o
  // el nuevo asignado/supervisor dejar el guild. Se reverifica todo dentro de
  // una transacción contra filas bloqueadas, de modo que un cambio concurrente
  // espere a que esta confirme en vez de colarse entre el check y el write.
  return db.transaction(async (tx) => {
    // La quest se bloquea ANTES que las membresías: así todos los endpoints de
    // quests toman los bloqueos en el mismo orden (quests → guild_members) y no
    // pueden quedar en deadlock entre sí. El bloqueo también congela el estado
    // (guild, creador, asignado, supervisor) del que depende la autorización.
    const lockedRows = await tx
      .select({
        ownerId: quests.ownerId,
        guildId: quests.guildId,
        assigneeId: quests.assigneeId,
        supervisorId: quests.supervisorId,
        // status y dueDate se leen aquí —dentro del mismo SELECT ... FOR UPDATE
        // que ya congela la fila para la reverificación— para tener los valores
        // PRE-update de la auditoría sin una lectura extra ni una carrera TOCTOU.
        status: quests.status,
        dueDate: quests.dueDate,
      })
      .from(quests)
      .where(eq(quests.id, data.id))
      .limit(1)
      .for('update')

    // Existía en la lectura previa; si ya no está, otra transacción la borró.
    if (lockedRows.length === 0) {
      throw new Error(
        'Conflict: the quest was deleted — please refresh and try again',
      )
    }

    const locked = lockedRows[0]

    if (locked.guildId) {
      // Mismos predicados y mismo orden que arriba, ahora contra el estado
      // bloqueado. Como la comprobación previa acaba de pasar, si fallan aquí
      // solo puede ser porque algo cambió: conflicto en vez de "Forbidden".
      const { viewer, roleByUserId } = await resolveLockedGuildQuestAuth(
        tx,
        locked.guildId,
        userId,
        [locked.ownerId, data.assigneeId, data.supervisorId],
      )
      const lockedTarget = {
        creatorId: locked.ownerId,
        creatorRole: roleByUserId.get(locked.ownerId) ?? null,
        assigneeId: locked.assigneeId,
        supervisorId: locked.supervisorId,
      }

      if (touchesManagementField) {
        if (!canManageGuildQuest(viewer, lockedTarget)) {
          throw new Error(
            'Conflict: your permissions on this quest changed — please refresh and try again',
          )
        }
      } else if (data.status !== undefined) {
        if (!canUpdateGuildQuestStatus(viewer, lockedTarget)) {
          throw new Error(
            'Conflict: your permissions on this quest changed — please refresh and try again',
          )
        }
      }

      if (data.assigneeId && !roleByUserId.has(data.assigneeId)) {
        throw new Error(
          'Conflict: the assignee is no longer a member of this guild — please refresh and try again',
        )
      }
      if (data.supervisorId && !roleByUserId.has(data.supervisorId)) {
        throw new Error(
          'Conflict: the supervisor is no longer a member of this guild — please refresh and try again',
        )
      }
    } else if (locked.ownerId !== userId) {
      throw new Error(
        'Conflict: your permissions on this quest changed — please refresh and try again',
      )
    }

    // El WHERE usa los valores BLOQUEADOS, no el snapshot previo: acota por id
    // y, para una quest de guild, por su guild (para no cruzar de guild); para
    // una personal, por owner (verificado ya, pero defensivo).
    const updated = await tx
      .update(quests)
      .set(updatePayload)
      .where(
        locked.guildId
          ? and(eq(quests.id, data.id), eq(quests.guildId, locked.guildId))
          : and(eq(quests.id, data.id), eq(quests.ownerId, userId)),
      )
      .returning()

    // returning() confirma que la fila seguía ahí al escribir. Con el bloqueo
    // tomado no debería poder faltar, pero 0 filas sería una escritura perdida
    // en silencio: se aborta para que el cliente no la dé por aplicada.
    if (updated.length === 0) {
      throw new Error(
        'Conflict: the quest changed while updating — please refresh and try again',
      )
    }

    // Auditoría: solo quests de guild. Una fila `field_updated` por cada campo
    // rastreado que CAMBIÓ de verdad (los no-ops no generan fila), en la MISMA
    // transacción que el UPDATE. Los `oldValue` salen de `locked` (estado
    // pre-update bloqueado); una quest personal (`locked.guildId` NULL) nunca
    // entra aquí.
    if (locked.guildId) {
      const guildId = locked.guildId
      const changes = computeGuildQuestFieldChanges(
        {
          status: locked.status,
          assigneeId: locked.assigneeId,
          supervisorId: locked.supervisorId,
          dueDate: locked.dueDate,
        },
        data,
      )
      if (changes.length > 0) {
        await tx.insert(guildQuestActivityLog).values(
          changes.map(
            (change): NewGuildQuestActivityLog => ({
              questId: data.id,
              guildId,
              actorId: userId,
              eventType: 'field_updated',
              field: change.field,
              oldValue: change.oldValue,
              newValue: change.newValue,
            }),
          ),
        )
      }
    }

    return updated[0]
  })
}
