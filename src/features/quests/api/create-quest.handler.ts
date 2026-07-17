// Lógica de negocio de la creación de una quest, separada del envoltorio RPC
// (create-quest.ts) para poder testearse directamente con `#/db` mockeado. El
// comportamiento (autorización de guild, checks de membresía de asignado/
// supervisor, transacción con reverificación bloqueada) es idéntico al que tenía
// inline en el handler.
import { db } from '#/db'
import { quests } from '#/db/schema'
import type { NewQuest } from '#/db/schema'
import { canCreateGuildQuest } from '#/features/guilds/role-labels'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import { parseQuestDueDateValue } from '../schemas/quest-schemas'
import type { CreateQuestValues } from '../schemas/quest-schemas'

export async function createQuestHandler(
  data: CreateQuestValues,
  userId: string,
) {
  // Autorización de contexto de guild. Solo aplica cuando la quest se crea
  // dentro de un guild; una quest personal no admite asignado ni supervisor.
  if (data.guildId) {
    // Contexto de autorización (viewer + roles de miembros) — compartido con
    // update/delete para no reimplementar el fetch ni divergir en las reglas.
    const { viewer, roleByUserId } = await resolveGuildQuestAuth(
      data.guildId,
      userId,
      [data.assigneeId, data.supervisorId],
    )

    // Solo el Guild Master o un Officer pueden crear quests de guild.
    if (!canCreateGuildQuest(viewer)) {
      throw new Error(
        'Forbidden: only the Guild Master or an Officer can create guild quests',
      )
    }

    if (data.assigneeId && !roleByUserId.has(data.assigneeId)) {
      throw new Error('Assignee must be a member of the guild')
    }
    if (data.supervisorId && !roleByUserId.has(data.supervisorId)) {
      throw new Error('Supervisor must be a member of the guild')
    }
  } else if (data.assigneeId || data.supervisorId) {
    // Defensa en profundidad: el esquema ya bloquea este caso, pero no
    // dependemos solo de la validación de entrada para una regla de negocio.
    throw new Error('Assignee and supervisor require a guild')
  }

  // Transformar tags de string CSV a array de strings limpias
  const tagsArray = data.tags
    ? data.tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean)
    : []

  // Transformar dueDate de string a Date si está presente
  const dueDate = parseQuestDueDateValue(data.dueDate ?? '')

  const questValues: NewQuest = {
    ownerId: userId,
    guildId: data.guildId ?? null,
    assigneeId: data.assigneeId ?? null,
    supervisorId: data.supervisorId ?? null,
    title: data.title,
    description: data.description ?? null,
    status: 'backlog',
    priority: data.priority,
    tags: tagsArray,
    dueDate,
  }

  // Una quest personal no depende de estado ajeno: su INSERT ya es atómico por
  // sí solo, así que no necesita transacción.
  const guildId = data.guildId
  if (!guildId) {
    const [quest] = await db.insert(quests).values(questValues).returning()

    return quest
  }

  // Una de guild sí: la autorización de arriba y este INSERT son dos
  // operaciones distintas, y en el hueco entre ambas el observador podría
  // perder el rol que le permitía crear, o el asignado/supervisor dejar de ser
  // miembro — la quest quedaría apuntando a quien ya no pertenece al guild. Se
  // reverifica dentro de una transacción contra las membresías bloqueadas
  // (`FOR UPDATE`), de modo que un cambio concurrente espere a que esta
  // confirme en vez de colarse entre el check y el write.
  return db.transaction(async (tx) => {
    const { viewer, roleByUserId } = await resolveLockedGuildQuestAuth(
      tx,
      guildId,
      userId,
      [data.assigneeId, data.supervisorId],
    )

    // Mismos predicados y mismo orden que arriba, ahora contra el estado
    // bloqueado. Como la comprobación previa acaba de pasar, si fallan aquí solo
    // puede ser porque algo cambió: de ahí el conflicto en vez del "Forbidden".
    if (!canCreateGuildQuest(viewer)) {
      throw new Error(
        'Conflict: your guild permissions changed — please refresh and try again',
      )
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

    const [quest] = await tx.insert(quests).values(questValues).returning()

    return quest
  })
}
