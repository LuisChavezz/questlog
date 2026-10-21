// Lógica de negocio de borrar un comentario de una quest de guild, separada del
// envoltorio RPC (delete-quest-comment.ts) para poder testearse directamente con
// `#/db` mockeado.
//
// Borrado DURO. Lo puede hacer el autor o el Guild Master
// (`canDeleteGuildQuestComment`). Comprobación previa sin bloqueo y
// reverificación dentro de la transacción, con los bloqueos en el orden
// quests → guild_members → comentario.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildQuestComments } from '#/db/schema'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import { canDeleteGuildQuestComment } from '#/features/guilds/role-labels'
import { withDeadlockRetry } from '#/lib/server/deadlock-retry'
import type { DeleteQuestCommentValues } from '../schemas/quest-comment-schemas'
import {
  lockCommentableQuest,
  resolveCommentableQuestOrThrow,
  selectQuestComment,
} from './resolve-commentable-quest'

// Conflicto genérico del borrado, compartido con el reintento por deadlock.
const COMMENT_DELETE_CONFLICT =
  'Conflict: the comment changed while deleting — please refresh and try again'

export async function deleteQuestCommentHandler(
  data: DeleteQuestCommentValues,
  userId: string,
) {
  const { guildId } = await resolveCommentableQuestOrThrow(data.questId)
  // `relatedUserIds` vacío a propósito: el predicado de borrado solo mira al
  // observador (autor por id, Guild Master por `guilds.owner_id`); el rol del
  // autor nunca se lee.
  const { viewer } = await resolveGuildQuestAuth(guildId, userId)

  const existing = await selectQuestComment(data.questId, data.commentId)
  if (!existing) {
    throw new Error('Not Found: comment not found')
  }
  if (!canDeleteGuildQuestComment(viewer, existing)) {
    throw new Error('Forbidden: you can only delete your own comments')
  }

  return withDeadlockRetry(
    () =>
      db.transaction(async (tx) => {
        // 1. Quest → 2. membresía → 3. comentario, todos bloqueados.
        await lockCommentableQuest(
          tx,
          data.questId,
          guildId,
          COMMENT_DELETE_CONFLICT,
        )
        // El dueño estructural se relee aquí: una transferencia de propiedad
        // confirmada entre medias le quita al ex-Guild Master la moderación.
        const { viewer: lockedViewer } = await resolveLockedGuildQuestAuth(
          tx,
          guildId,
          userId,
        )
        const locked = await selectQuestComment(
          data.questId,
          data.commentId,
          tx,
        )

        if (!locked) {
          throw new Error(
            'Conflict: the comment was already deleted — please refresh and try again',
          )
        }
        if (!canDeleteGuildQuestComment(lockedViewer, locked)) {
          throw new Error(
            'Conflict: your permissions on this comment changed — please refresh and try again',
          )
        }

        // Acotado por id de comentario Y de quest: solo puede caer la fila que
        // se acaba de bloquear y verificar.
        const deleted = await tx
          .delete(guildQuestComments)
          .where(
            and(
              eq(guildQuestComments.id, data.commentId),
              eq(guildQuestComments.questId, data.questId),
            ),
          )
          .returning({ id: guildQuestComments.id })

        if (deleted.length === 0) {
          throw new Error(COMMENT_DELETE_CONFLICT)
        }

        return { id: data.commentId, questId: data.questId }
      }),
    COMMENT_DELETE_CONFLICT,
  )
}
