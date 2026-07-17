// Lógica de negocio del borrado múltiple de quests, separada del envoltorio RPC
// (delete-quests.ts) para poder testearse directamente con `#/db` mockeado.
// Fail-closed: si UNA sola de las seleccionadas no es gestionable por el
// observador, se aborta todo el lote (no se borra ninguna). El comportamiento
// (autorización por guild, transacción con reverificación bloqueada) es idéntico
// al que tenía inline en el handler.
import { inArray } from 'drizzle-orm'

import { db } from '#/db'
import { quests } from '#/db/schema'
import { canManageGuildQuest } from '#/features/guilds/role-labels'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import type { GuildQuestAuthContext } from '#/features/guilds/api/resolve-guild-quest-auth'
import type { DeleteQuestsValues } from '../schemas/quest-schemas'

export async function deleteQuestsHandler(
  data: DeleteQuestsValues,
  userId: string,
) {
  // Leer las quests seleccionadas para autorizar cada una: borrar es gestión
  // completa (eje 1). Una quest personal solo la borra su creador; una de guild,
  // quien pueda gestionarla según los predicados compartidos.
  const existing = await db
    .select({
      id: quests.id,
      ownerId: quests.ownerId,
      guildId: quests.guildId,
      assigneeId: quests.assigneeId,
      supervisorId: quests.supervisorId,
    })
    .from(quests)
    .where(inArray(quests.id, data.ids))

  if (existing.length === 0) {
    return []
  }

  // El contexto de autorización se resuelve una vez por guild involucrado. Se
  // agrupan antes los creadores de cada guild para pedir sus roles con una
  // sola consulta acotada (inArray) por guild, en vez de traer cada miembro.
  const precheckGuildIds = [
    ...new Set(
      existing
        .map((quest) => quest.guildId)
        .filter((guildId): guildId is string => guildId != null),
    ),
  ]

  const authByGuild = new Map<string, GuildQuestAuthContext>()

  for (const guildId of precheckGuildIds) {
    const creatorIds = existing
      .filter((quest) => quest.guildId === guildId)
      .map((quest) => quest.ownerId)

    authByGuild.set(
      guildId,
      await resolveGuildQuestAuth(guildId, userId, creatorIds),
    )
  }

  for (const quest of existing) {
    if (quest.guildId) {
      const guildAuth = authByGuild.get(quest.guildId)!

      const canManage = canManageGuildQuest(guildAuth.viewer, {
        creatorId: quest.ownerId,
        creatorRole: guildAuth.roleByUserId.get(quest.ownerId) ?? null,
        assigneeId: quest.assigneeId,
        supervisorId: quest.supervisorId,
      })
      if (!canManage) {
        throw new Error(
          'Forbidden: you do not have permission to delete one or more of the selected quests',
        )
      }
    } else if (quest.ownerId !== userId) {
      throw new Error(
        'Forbidden: you do not have permission to delete one or more of the selected quests',
      )
    }
  }

  // La autorización de arriba se resolvió sobre lecturas ya soltadas: entre
  // ellas y este DELETE, alguna quest pudo reasignarse o el observador perder el
  // rol que le permitía borrarla. Se reverifica dentro de una transacción contra
  // filas bloqueadas, de modo que un cambio concurrente espere a que esta
  // confirme en vez de colarse entre el check y el write.
  return db.transaction(async (tx) => {
    // Las quests se bloquean ANTES que las membresías: mismo orden (quests →
    // guild_members) en todos los endpoints de quests. Se releen porque alguna
    // pudo cambiar —o desaparecer— desde la lectura de arriba.
    const locked = await tx
      .select({
        id: quests.id,
        ownerId: quests.ownerId,
        guildId: quests.guildId,
        assigneeId: quests.assigneeId,
        supervisorId: quests.supervisorId,
      })
      .from(quests)
      .where(
        inArray(
          quests.id,
          existing.map((quest) => quest.id),
        ),
      )
      .for('update')

    // Otra transacción se adelantó y ya las borró todas. Igual que arriba, no es
    // un error: el resultado que pedía el cliente ya se cumplió.
    if (locked.length === 0) {
      return []
    }

    // El contexto de autorización se resuelve una vez por guild involucrado, en
    // ORDEN DE ID: una selección de la tabla personal puede abarcar varios guilds
    // (getQuests filtra por owner, no por guild), y así dos borrados masivos
    // concurrentes toman los bloqueos de membresía en el mismo orden y no pueden
    // quedar en deadlock entre sí.
    const guildIds = [
      ...new Set(
        locked
          .map((quest) => quest.guildId)
          .filter((guildId): guildId is string => guildId != null),
      ),
    ].sort()

    const lockedAuthByGuild = new Map<string, GuildQuestAuthContext>()

    for (const guildId of guildIds) {
      // Los creadores de las quests de ESTE guild: sus roles deciden si el
      // observador puede gestionarlas, así que se bloquean con el resto.
      const creatorIds = locked
        .filter((quest) => quest.guildId === guildId)
        .map((quest) => quest.ownerId)

      lockedAuthByGuild.set(
        guildId,
        await resolveLockedGuildQuestAuth(tx, guildId, userId, creatorIds),
      )
    }

    // Mismos predicados que arriba, ahora contra el estado bloqueado. Como la
    // comprobación previa acaba de pasar, si fallan aquí solo puede ser porque
    // algo cambió: conflicto en vez de "Forbidden".
    for (const quest of locked) {
      if (quest.guildId) {
        const guildAuth = lockedAuthByGuild.get(quest.guildId)!

        const canManage = canManageGuildQuest(guildAuth.viewer, {
          creatorId: quest.ownerId,
          creatorRole: guildAuth.roleByUserId.get(quest.ownerId) ?? null,
          assigneeId: quest.assigneeId,
          supervisorId: quest.supervisorId,
        })
        if (!canManage) {
          throw new Error(
            'Conflict: your permissions on one or more of the selected quests changed — please refresh and try again',
          )
        }
      } else if (quest.ownerId !== userId) {
        throw new Error(
          'Conflict: your permissions on one or more of the selected quests changed — please refresh and try again',
        )
      }
    }

    // Todas autorizadas — se borran las filas bloqueadas (no `data.ids`, que
    // podría incluir ids inexistentes ya filtrados arriba).
    const deleted = await tx
      .delete(quests)
      .where(
        inArray(
          quests.id,
          locked.map((quest) => quest.id),
        ),
      )
      .returning()

    // returning() confirma que seguían ahí al escribir. Con los bloqueos tomados
    // no debería faltar ninguna, pero un borrado parcial dejaría al cliente
    // creyendo que se fueron todas: se aborta y revierte.
    if (deleted.length !== locked.length) {
      throw new Error(
        'Conflict: the selected quests changed while deleting — please refresh and try again',
      )
    }

    return deleted
  })
}
