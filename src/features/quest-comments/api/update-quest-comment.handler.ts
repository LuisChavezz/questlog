// Lógica de negocio de editar un comentario de una quest de guild, separada del
// envoltorio RPC (update-quest-comment.ts) para poder testearse directamente con
// `#/db` mockeado.
//
// Solo el autor edita su comentario (`canEditGuildQuestComment`). Comprobación
// previa sin bloqueo y reverificación dentro de la transacción, con los
// bloqueos en el orden quests → guild_members → comentario.
import { and, eq, sql } from 'drizzle-orm'

import { db } from '#/db'
import { guildQuestComments } from '#/db/schema'
import {
  resolveGuildQuestAuth,
  resolveLockedGuildQuestAuth,
} from '#/features/guilds/api/resolve-guild-quest-auth'
import { canEditGuildQuestComment } from '#/features/guilds/role-labels'
import { withDeadlockRetry } from '#/lib/server/deadlock-retry'
import type { UpdateQuestCommentValues } from '../schemas/quest-comment-schemas'
import { toQuestCommentItem } from './quest-comment-item'
import type { QuestCommentItem } from './quest-comment-item'
import {
  lockCommentableQuest,
  resolveCommentableQuestOrThrow,
  selectCommentAuthor,
  selectQuestComment,
} from './resolve-commentable-quest'

// Conflicto genérico de la edición, compartido con el reintento por deadlock.
const COMMENT_EDIT_CONFLICT =
  'Conflict: the comment changed while saving — please refresh and try again'

export async function updateQuestCommentHandler(
  data: UpdateQuestCommentValues,
  userId: string,
): Promise<QuestCommentItem> {
  const { guildId } = await resolveCommentableQuestOrThrow(data.questId)
  // `relatedUserIds` vacío a propósito: el predicado de edición compara el
  // autor por id con el observador; no se lee el rol de nadie más.
  const { viewer } = await resolveGuildQuestAuth(guildId, userId)

  const existing = await selectQuestComment(data.questId, data.commentId)
  if (!existing) {
    throw new Error('Not Found: comment not found')
  }
  if (!canEditGuildQuestComment(viewer, existing)) {
    throw new Error('Forbidden: you can only edit your own comments')
  }
  // Solo el autor edita, así que el autor es el observador: sus datos de
  // presentación se leen aquí, sin bloqueo, y no dentro de la transacción.
  const author = await selectCommentAuthor(userId)

  return withDeadlockRetry(
    () =>
      db.transaction(async (tx) => {
        // 1. Quest → 2. membresía → 3. comentario, todos bloqueados.
        await lockCommentableQuest(
          tx,
          data.questId,
          guildId,
          COMMENT_EDIT_CONFLICT,
        )
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

        // La comprobación previa acaba de encontrarlo y autorizarlo: si ya no
        // está, o el predicado ya no se cumple (la cuenta del autor se borró y
        // el comentario quedó huérfano), solo puede ser un cambio concurrente.
        if (!locked) {
          throw new Error(
            'Conflict: the comment was deleted — please refresh and try again',
          )
        }
        if (!canEditGuildQuestComment(lockedViewer, locked)) {
          throw new Error(
            'Conflict: your permissions on this comment changed — please refresh and try again',
          )
        }

        // Cuerpo idéntico tras recortar (el esquema ya recortó `data.body`): no
        // es una edición, así que no se escribe ni se marca `edited_at`.
        if (locked.body === data.body) {
          return toQuestCommentItem({ ...locked, ...author }, lockedViewer)
        }

        const updatedRows = await tx
          .update(guildQuestComments)
          // `clock_timestamp()` de Postgres, no un `Date` del servidor de la app
          // ni `now()` (inicio de la transacción, que pudo esperar el bloqueo):
          // mismo reloj que el default de `created_at`.
          .set({ body: data.body, editedAt: sql`clock_timestamp()` })
          .where(
            and(
              eq(guildQuestComments.id, data.commentId),
              eq(guildQuestComments.questId, data.questId),
            ),
          )
          .returning()

        // Con el bloqueo tomado no debería faltar, pero 0 filas sería una
        // escritura perdida en silencio.
        const updated = updatedRows.at(0)
        if (!updated) {
          throw new Error(COMMENT_EDIT_CONFLICT)
        }

        return toQuestCommentItem({ ...updated, ...author }, lockedViewer)
      }),
    COMMENT_EDIT_CONFLICT,
  )
}
