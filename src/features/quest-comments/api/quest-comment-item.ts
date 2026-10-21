// Forma de presentación de un comentario, compartida por el lector paginado y
// por las mutaciones (que devuelven la fila creada/editada con esta MISMA forma
// para que el cliente la inserte en la caché sin refetch). Sigue la del actor de
// la bitácora (`guild-activity-log-query.ts`): el email del autor solo sirve para
// las iniciales de respaldo y nunca viaja al cliente.
import { user } from '#/db/schema'
import {
  canDeleteGuildQuestComment,
  canEditGuildQuestComment,
} from '#/features/guilds/role-labels'
import type { GuildMemberViewer } from '#/features/guilds/role-labels'
import { getUserInitials } from '#/lib/get-user-initials'
import type { QuestCommentCursor } from '../schemas/quest-comment-schemas'

// Tamaño de página del hilo: los 20 más recientes primero, y "Load older" trae
// los 20 anteriores a cada cursor.
export const QUEST_COMMENTS_PAGE_SIZE = 20

// Autor ya resuelto a datos de presentación. `null` cuando su cuenta se borró y
// el FK quedó en NULL (ON DELETE SET NULL): la UI pinta "Unknown user".
export interface QuestCommentAuthor {
  id: string
  name: string | null
  image: string | null
  avatarId: string | null
  initials: string
}

// Un comentario listo para renderizar. `canEdit`/`canDelete` se evalúan en el
// servidor con los predicados compartidos de role-labels para el observador que
// hizo la petición: el drawer no tiene (ni necesita) el dueño estructural del
// guild para decidirlo por su cuenta.
export interface QuestCommentItem {
  id: string
  body: string
  createdAt: Date
  editedAt: Date | null
  author: QuestCommentAuthor | null
  canEdit: boolean
  canDelete: boolean
}

// Una página del hilo, de más reciente a más antiguo. `nextCursor` apunta al
// último (el más antiguo) de la página, o es null si no quedan anteriores.
export interface QuestCommentsPage {
  items: QuestCommentItem[]
  nextCursor: QuestCommentCursor | null
  hasMore: boolean
}

// Columnas del autor para un SELECT con LEFT JOIN a `user` (o una lectura
// directa de `user`). Compartidas para que lector y mutaciones resuelvan el
// autor exactamente igual.
export const questCommentAuthorColumns = {
  authorName: user.name,
  authorEmail: user.email,
  authorImage: user.image,
  authorAvatarId: user.avatarId,
}

// Fila de comentario + columnas del autor, tal como la devuelven las consultas.
export interface QuestCommentRow {
  id: string
  body: string
  createdAt: Date
  editedAt: Date | null
  authorId: string | null
  authorName: string | null
  authorEmail: string | null
  authorImage: string | null
  authorAvatarId: string | null
}

/**
 * Mapea una fila a su forma de presentación y resuelve los permisos del
 * observador sobre ese comentario con los predicados compartidos.
 */
export function toQuestCommentItem(
  row: QuestCommentRow,
  viewer: Pick<GuildMemberViewer, 'viewerId' | 'ownerId'>,
): QuestCommentItem {
  const target = { authorId: row.authorId }

  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    author: row.authorId
      ? {
          id: row.authorId,
          name: row.authorName,
          image: row.authorImage,
          avatarId: row.authorAvatarId,
          initials: getUserInitials(row.authorName, row.authorEmail),
        }
      : null,
    canEdit: canEditGuildQuestComment(viewer, target),
    canDelete: canDeleteGuildQuestComment(viewer, target),
  }
}

/**
 * Cursor que señala un comentario dentro del orden (created_at, id). La fecha
 * sale con `toISOString()` (milisegundos, UTC), la misma precisión que guarda la
 * columna, así que el cursor coincide exactamente con la fila.
 */
export function toQuestCommentCursor(
  item: Pick<QuestCommentItem, 'createdAt' | 'id'>,
): QuestCommentCursor {
  return { createdAt: item.createdAt.toISOString(), id: item.id }
}
