// Lógica de negocio de publicar un comentario en una quest de guild, separada
// del envoltorio RPC (create-quest-comment.ts) para poder testearse directamente
// con `#/db` mockeado.
//
// Mismo esquema que los endpoints de quests: comprobación previa sin bloqueo
// (decide el error que ve el usuario) y reverificación dentro de una
// transacción contra filas bloqueadas, en el orden quests → guild_members.
import { db } from '#/db'
import { guildQuestComments } from '#/db/schema'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import { withDeadlockRetry } from '#/lib/server/deadlock-retry'
import type { CreateQuestCommentValues } from '../schemas/quest-comment-schemas'
import { toQuestCommentItem } from './quest-comment-item'
import type { QuestCommentItem } from './quest-comment-item'
import {
  lockCommentableQuest,
  resolveCommentableQuestOrThrow,
  selectCommentAuthor,
} from './resolve-commentable-quest'

// Conflicto genérico de la publicación. Se comparte con el reintento por
// deadlock para que un choque de bloqueos irresoluble se vea igual que cualquier
// otra carrera perdida, sin filtrar el «deadlock detected» crudo de Postgres.
const COMMENT_POST_CONFLICT =
  'Conflict: the quest changed while posting your comment — please refresh and try again'

export async function createQuestCommentHandler(
  data: CreateQuestCommentValues,
  userId: string,
): Promise<QuestCommentItem> {
  // Comprobación previa: "Not Found" para quest inexistente o personal y
  // "Forbidden" si el observador no es miembro vigente de su guild.
  // `relatedUserIds` vacío a propósito: comentar solo depende de la membresía
  // del observador, y ningún predicado de comentarios lee el rol de otro.
  const { guildId } = await resolveCommentableQuestOrThrow(data.questId)
  await resolveGuildQuestAuth(guildId, userId)

  // Riesgo de deadlock con delete-guild: ese handler bloquea `guilds` y su
  // cascada baja a `guild_members` y `quests`; aquí se toma `quests` y después
  // `guild_members`. Se absorbe reintentando la transacción una vez, igual que
  // update-quest, en vez de reordenar.
  return withDeadlockRetry(
    () =>
      db.transaction(async (tx) => {
        // 1. La quest, bloqueada. Además de fijar el orden de bloqueos, impide
        // que se borre entre la reverificación y el INSERT.
        await lockCommentableQuest(
          tx,
          data.questId,
          guildId,
          COMMENT_POST_CONFLICT,
        )

        // 2. La membresía del observador, bloqueada: una expulsión o salida
        // concurrente espera a que esto confirme. Si ya se fue, el helper lanza
        // su "Forbidden" (mismo criterio que el resto de endpoints de quests).
        // `relatedUserIds` vacío: ver la comprobación previa.
        const { viewer } = await resolveLockedGuildQuestAuth(
          tx,
          guildId,
          userId,
        )

        const [created] = await tx
          .insert(guildQuestComments)
          .values({
            questId: data.questId,
            authorId: userId,
            body: data.body,
          })
          .returning()

        const author = await selectCommentAuthor(tx, userId)

        return toQuestCommentItem({ ...created, ...author }, viewer)
      }),
    COMMENT_POST_CONFLICT,
  )
}
