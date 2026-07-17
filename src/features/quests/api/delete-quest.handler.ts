// Lógica de negocio del borrado de una quest, separada del envoltorio RPC
// (delete-quest.ts) para poder testearse directamente con `#/db` mockeado. El
// comportamiento (autorización de eje 1, transacción con reverificación
// bloqueada) es idéntico al que tenía inline en el handler.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { quests } from '#/db/schema'
import { canManageGuildQuest } from '#/features/guilds/role-labels'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import type { DeleteQuestValues } from '../schemas/quest-schemas'

export async function deleteQuestHandler(
  data: DeleteQuestValues,
  userId: string,
) {
  // Se lee la quest para autorizar: borrar es gestión completa (eje 1). Para
  // una quest de guild la autoridad son los predicados compartidos; para una
  // personal, solo el creador.
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
    // Nada que borrar — no es un error (p. ej. ya se eliminó).
    return undefined
  }

  const existing = existingRows[0]

  if (existing.guildId) {
    const { viewer, roleByUserId } = await resolveGuildQuestAuth(
      existing.guildId,
      userId,
      [existing.ownerId],
    )
    const canManage = canManageGuildQuest(viewer, {
      creatorId: existing.ownerId,
      creatorRole: roleByUserId.get(existing.ownerId) ?? null,
      assigneeId: existing.assigneeId,
      supervisorId: existing.supervisorId,
    })
    if (!canManage) {
      throw new Error(
        'Forbidden: you do not have permission to delete this quest',
      )
    }
  } else if (existing.ownerId !== userId) {
    throw new Error(
      'Forbidden: you do not have permission to delete this quest',
    )
  }

  // La autorización de arriba se resolvió sobre una lectura ya soltada: entre
  // ella y este DELETE, la quest pudo reasignarse o el observador perder el rol
  // que le permitía borrarla. Se reverifica dentro de una transacción contra
  // filas bloqueadas, de modo que un cambio concurrente espere a que esta
  // confirme en vez de colarse entre el check y el write.
  return db.transaction(async (tx) => {
    // La quest se bloquea ANTES que las membresías: mismo orden (quests →
    // guild_members) en todos los endpoints de quests, para no arriesgar
    // deadlocks entre ellos.
    const lockedRows = await tx
      .select({
        ownerId: quests.ownerId,
        guildId: quests.guildId,
        assigneeId: quests.assigneeId,
        supervisorId: quests.supervisorId,
      })
      .from(quests)
      .where(eq(quests.id, data.id))
      .limit(1)
      .for('update')

    // Otra transacción se adelantó y ya la borró. Igual que arriba, no es un
    // error: el resultado que pedía el cliente ya se cumplió.
    if (lockedRows.length === 0) {
      return undefined
    }

    const locked = lockedRows[0]

    // Mismos predicados y mismo orden que arriba, ahora contra el estado
    // bloqueado. Como la comprobación previa acaba de pasar, si fallan aquí solo
    // puede ser porque algo cambió: conflicto en vez de "Forbidden".
    if (locked.guildId) {
      const { viewer, roleByUserId } = await resolveLockedGuildQuestAuth(
        tx,
        locked.guildId,
        userId,
        [locked.ownerId],
      )
      const canManage = canManageGuildQuest(viewer, {
        creatorId: locked.ownerId,
        creatorRole: roleByUserId.get(locked.ownerId) ?? null,
        assigneeId: locked.assigneeId,
        supervisorId: locked.supervisorId,
      })
      if (!canManage) {
        throw new Error(
          'Conflict: your permissions on this quest changed — please refresh and try again',
        )
      }
    } else if (locked.ownerId !== userId) {
      throw new Error(
        'Conflict: your permissions on this quest changed — please refresh and try again',
      )
    }

    // El WHERE usa los valores BLOQUEADOS, no el snapshot previo: acota por id
    // y, para una quest de guild, por su guild (para no cruzar de guild); para
    // una personal, por owner (defensivo).
    const deleted = await tx
      .delete(quests)
      .where(
        locked.guildId
          ? and(eq(quests.id, data.id), eq(quests.guildId, locked.guildId))
          : and(eq(quests.id, data.id), eq(quests.ownerId, userId)),
      )
      .returning()

    // returning() confirma que la fila seguía ahí al escribir. Con el bloqueo
    // tomado no debería poder faltar, pero 0 filas sería un borrado que nunca
    // ocurrió: se aborta para que el cliente no lo dé por aplicado.
    if (deleted.length === 0) {
      throw new Error(
        'Conflict: the quest changed while deleting — please refresh and try again',
      )
    }

    return deleted[0]
  })
}
