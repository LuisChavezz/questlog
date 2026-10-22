// Helpers de servidor — resuelven la quest de un hilo de comentarios y, de paso,
// el guild del que depende la autorización. Comunes a los cuatro endpoints, que
// así comparten el criterio de "quest comentable" y sus mensajes de error.
//
// El guild se deriva SIEMPRE de `quests.guild_id`: la tabla de comentarios no lo
// desnormaliza.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildQuestComments, quests, user } from '#/db/schema'
import type { GuildQuestAuthTx } from '#/features/guilds/api/resolve-guild-quest-auth'
import { questCommentAuthorColumns } from './quest-comment-item'

/**
 * Comprobación previa (sin bloqueo): localiza la quest y devuelve su guild.
 * Una quest inexistente y una quest PERSONAL dan el mismo "Not Found": las
 * personales no tienen comentarios, y distinguirlas revelaría que existen.
 */
export async function resolveCommentableQuestOrThrow(
  questId: string,
): Promise<{ guildId: string }> {
  const rows = await db
    .select({ guildId: quests.guildId })
    .from(quests)
    .where(eq(quests.id, questId))
    .limit(1)

  const guildId = rows[0]?.guildId
  if (!guildId) {
    throw new Error('Not Found: quest not found')
  }

  return { guildId }
}

/**
 * Relectura bloqueada (`FOR UPDATE`) de la quest dentro de la transacción de
 * una mutación — el PRIMER bloqueo, para respetar el orden de todos los
 * endpoints de quests (quests → guild_members). Como la comprobación previa la
 * acaba de encontrar, si ya no está (o cambió de guild) solo puede ser una
 * carrera: se lanza `conflictMessage`.
 */
export async function lockCommentableQuest(
  tx: GuildQuestAuthTx,
  questId: string,
  expectedGuildId: string,
  conflictMessage: string,
): Promise<{ guildId: string }> {
  const rows = await tx
    .select({ guildId: quests.guildId })
    .from(quests)
    .where(eq(quests.id, questId))
    .limit(1)
    .for('update')

  const guildId = rows[0]?.guildId
  if (!guildId || guildId !== expectedGuildId) {
    throw new Error(conflictMessage)
  }

  return { guildId }
}

/**
 * Lee un comentario acotado por su id Y por su quest — un id de comentario de
 * otra quest no se encuentra. Con `tx`, la lectura va bloqueada (`FOR UPDATE`):
 * es el TERCER bloqueo de update/delete, después de la quest y las membresías.
 */
export async function selectQuestComment(
  questId: string,
  commentId: string,
  tx?: GuildQuestAuthTx,
) {
  const query = (tx ?? db)
    .select({
      id: guildQuestComments.id,
      authorId: guildQuestComments.authorId,
      body: guildQuestComments.body,
      createdAt: guildQuestComments.createdAt,
      editedAt: guildQuestComments.editedAt,
    })
    .from(guildQuestComments)
    .where(
      and(
        eq(guildQuestComments.id, commentId),
        eq(guildQuestComments.questId, questId),
      ),
    )
    .limit(1)

  const rows = await (tx ? query.for('update') : query)
  return rows.at(0) ?? null
}

/**
 * Datos de presentación de un autor por id, para devolver la fila creada o
 * editada con la misma forma que el lector. Se lee en la comprobación previa,
 * FUERA de la transacción: el nombre o el avatar no participan en ninguna
 * decisión de autorización, así que no tiene sentido alargar con esta lectura
 * el tiempo que se retienen los bloqueos de quest, membresía y comentario.
 */
export async function selectCommentAuthor(userId: string) {
  const rows = await db
    .select(questCommentAuthorColumns)
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return (
    rows.at(0) ?? {
      authorName: null,
      authorEmail: null,
      authorImage: null,
      authorAvatarId: null,
    }
  )
}
