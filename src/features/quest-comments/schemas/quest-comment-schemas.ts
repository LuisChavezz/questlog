/**
 * Esquemas de validación de los comentarios de quests de guild. Fuente única
 * para el composer, el editor inline y el `.inputValidator` de los endpoints.
 */
import { z } from 'zod'

import { questIdSchema } from '#/features/quests/schemas/quest-schemas'

/** Límite de caracteres del cuerpo de un comentario (tras recortar). */
export const COMMENT_BODY_MAX_LENGTH = 2000

/**
 * Cuerpo de un comentario: texto plano con saltos de línea. `.trim()` va ANTES
 * de las cotas a propósito (mismo criterio que `guildNameSchema`): un cuerpo
 * solo de espacios queda vacío y se rechaza, y el límite se mide sobre lo que
 * realmente se guarda. El valor que sale del parseo ya viene recortado.
 */
export const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'Comment cannot be empty')
  .max(
    COMMENT_BODY_MAX_LENGTH,
    `Comment must be ${COMMENT_BODY_MAX_LENGTH} characters or fewer`,
  )

/**
 * Id de un comentario (uuid de `guild_quest_comments.id`). Comparte la regla
 * con `questIdSchema` pero es otro concepto — no se consolidan, mismo criterio
 * que `questGuildIdSchema` / `questUserRefSchema`.
 */
export const questCommentIdSchema = z.string().uuid()

/**
 * Cursor de paginación por clave (keyset) sobre `(created_at, id)`: la fecha
 * viaja como string ISO 8601 en UTC con milisegundos (`Date#toISOString()`) y
 * el id como uuid. Se pasa tal cual a Postgres (`::timestamptz`), así que el
 * servidor nunca reconstruye la fecha en JS: la precisión 3 de la columna
 * garantiza que el valor coincide exactamente con el guardado.
 */
export const questCommentCursorSchema = z.object({
  createdAt: z.iso.datetime(),
  id: questCommentIdSchema,
})

export type QuestCommentCursor = z.infer<typeof questCommentCursorSchema>

// ─── Entradas de los endpoints ────────────────────────────────────────────────

/** Página del hilo: sin cursor, la más reciente; con cursor, la anterior a él. */
export const getQuestCommentsSchema = z.object({
  questId: questIdSchema,
  cursor: questCommentCursorSchema.optional(),
})

export type GetQuestCommentsValues = z.infer<typeof getQuestCommentsSchema>

export const createQuestCommentSchema = z.object({
  questId: questIdSchema,
  body: commentBodySchema,
})

export type CreateQuestCommentValues = z.infer<typeof createQuestCommentSchema>

export const updateQuestCommentSchema = z.object({
  questId: questIdSchema,
  commentId: questCommentIdSchema,
  body: commentBodySchema,
})

export type UpdateQuestCommentValues = z.infer<typeof updateQuestCommentSchema>

export const deleteQuestCommentSchema = z.object({
  questId: questIdSchema,
  commentId: questCommentIdSchema,
})

export type DeleteQuestCommentValues = z.infer<typeof deleteQuestCommentSchema>
