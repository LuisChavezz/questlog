// Lógica de negocio del lector paginado del hilo de comentarios de una quest de
// guild, separada del envoltorio RPC (get-quest-comments.ts) para poder
// testearse directamente con `#/db` mockeado — el envoltorio solo resuelve la
// sesión y delega aquí con el `userId` ya autenticado.
//
// Lectura sin bloqueo y sin transacción: no escribe nada, y una página
// ligeramente desfasada respecto a una escritura concurrente se corrige con la
// siguiente invalidación.
import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '#/db'
import { guildQuestComments, user } from '#/db/schema'
import { resolveGuildQuestAuth } from '#/features/guilds/api/resolve-guild-quest-auth'
import type { GetQuestCommentsValues } from '../schemas/quest-comment-schemas'
import {
  QUEST_COMMENTS_PAGE_SIZE,
  questCommentAuthorColumns,
  toQuestCommentCursor,
  toQuestCommentItem,
} from './quest-comment-item'
import type { QuestCommentsPage } from './quest-comment-item'
import { resolveCommentableQuestOrThrow } from './resolve-commentable-quest'

export async function getQuestCommentsHandler(
  data: GetQuestCommentsValues,
  userId: string,
): Promise<QuestCommentsPage> {
  // "Not Found" para quest inexistente o personal, antes que la membresía.
  const { guildId } = await resolveCommentableQuestOrThrow(data.questId)

  // Leer exige ser miembro vigente del guild de la quest ("Forbidden" si no).
  // `relatedUserIds` vacío a propósito: los predicados de comentarios solo leen
  // al observador (su id y el dueño estructural); el autor se compara por id,
  // nunca por rol, así que no hay que resolver la membresía de nadie más.
  const { viewer } = await resolveGuildQuestAuth(guildId, userId)

  const { cursor } = data
  const rows = await db
    .select({
      id: guildQuestComments.id,
      body: guildQuestComments.body,
      createdAt: guildQuestComments.createdAt,
      editedAt: guildQuestComments.editedAt,
      authorId: guildQuestComments.authorId,
      ...questCommentAuthorColumns,
    })
    .from(guildQuestComments)
    // LEFT JOIN: el autor puede ser NULL (cuenta borrada).
    .leftJoin(user, eq(guildQuestComments.authorId, user.id))
    .where(
      and(
        eq(guildQuestComments.questId, data.questId),
        // Paginación por clave: comparación de fila (created_at, id) < cursor,
        // que recorre el índice (quest_id, created_at, id) sin offset. Los
        // valores del cursor van como parámetros con cast explícito: la fecha
        // llega como string ISO y se compara tal cual, sin pasar por `Date`.
        cursor
          ? sql`(${guildQuestComments.createdAt}, ${guildQuestComments.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    // Más recientes primero, con el id como desempate: dos comentarios con el
    // mismo `created_at` (misma resolución de milisegundos) tendrían si no un
    // orden indefinido y el cursor podría saltarse o repetir uno de ellos.
    .orderBy(desc(guildQuestComments.createdAt), desc(guildQuestComments.id))
    // Una fila de más para saber si quedan anteriores sin un COUNT aparte.
    .limit(QUEST_COMMENTS_PAGE_SIZE + 1)

  const hasMore = rows.length > QUEST_COMMENTS_PAGE_SIZE
  const items = rows
    .slice(0, QUEST_COMMENTS_PAGE_SIZE)
    .map((row) => toQuestCommentItem(row, viewer))
  const oldest = items.at(-1)

  return {
    items,
    nextCursor: hasMore && oldest ? toQuestCommentCursor(oldest) : null,
    hasMore,
  }
}
