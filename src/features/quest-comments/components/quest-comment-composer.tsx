/**
 * QuestCommentComposer — caja para publicar un comentario en una quest de
 * guild. Enter inserta un salto de línea y Ctrl/Cmd+Enter publica. El borrador
 * vive en memoria por quest (`comment-drafts.ts`): sobrevive a cerrar el drawer
 * o cambiar de quest y se pierde al recargar.
 *
 * Pinta también el último error de una mutación de comentarios de ESTA quest
 * (publicar, editar o borrar): está en el pie fijo del drawer, así que se ve
 * aunque el hilo esté desplazado.
 */
import { RotateCcw, SendHorizontal, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { authClient } from '#/lib/auth-client'
import { getUserInitials } from '#/lib/get-user-initials'
import { cn } from '#/lib/utils'
import type { QuestCommentAuthor } from '../api/quest-comment-item'
import {
  discardUnsentComment,
  restoreUnsentComment,
  setCommentDraft,
  useCommentDraft,
  useCommentError,
  useUnsentComments,
} from '../comment-drafts'
import { useCreateQuestComment } from '../hooks/use-create-quest-comment'
import {
  COMMENT_BODY_MAX_LENGTH,
  commentBodySchema,
} from '../schemas/quest-comment-schemas'
import {
  isSubmitShortcut,
  QUEST_COMMENT_INPUT_ATTR,
} from './quest-comment-input'

// A partir de cuántos caracteres (recortados) aparece el contador.
const COUNTER_THRESHOLD = COMMENT_BODY_MAX_LENGTH - 200

// Autor del comentario optimista: el usuario de la sesión, desde el mismo
// `authClient.useSession()` que pinta el avatar del header (y que recibe el
// parche optimista al cambiar de avatar). `null` mientras la sesión carga: el
// servidor devuelve el autor real al confirmar.
function useSessionAuthor(): QuestCommentAuthor | null {
  const { data: session } = authClient.useSession()
  const sessionUser = session?.user
  if (!sessionUser) return null

  return {
    id: sessionUser.id,
    name: sessionUser.name,
    image: sessionUser.image ?? null,
    avatarId: sessionUser.avatarId ?? null,
    initials: getUserInitials(sessionUser.name, sessionUser.email),
  }
}

export function QuestCommentComposer({ questId }: { questId: string }) {
  // El textarea lee del store por quest: un borrador restaurado tras un fallo
  // aparece aquí aunque el fallo llegue después de cambiar de quest y volver.
  const draft = useCommentDraft(questId)
  const error = useCommentError(questId)
  const createComment = useCreateQuestComment(questId, useSessionAuthor())

  const trimmedLength = draft.trim().length
  const canSubmit = commentBodySchema.safeParse(draft).success
  const isOverLimit = trimmedLength > COMMENT_BODY_MAX_LENGTH

  const submit = () => {
    const parsed = commentBodySchema.safeParse(draft)
    if (!parsed.success) return

    // Se vacía en el acto: el comentario ya se ve como optimista en el hilo. Si
    // el servidor lo rechaza, el hook lo devuelve al borrador (si sigue vacío).
    setCommentDraft(questId, '')
    createComment.mutate(parsed.data)
  }

  return (
    <form
      aria-label="Add a comment"
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <CommentNotice questId={questId} error={error} />

      <Textarea
        {...{ [QUEST_COMMENT_INPUT_ATTR]: 'true' }}
        aria-label="Write a comment"
        placeholder="Write a comment…"
        value={draft}
        aria-invalid={isOverLimit || undefined}
        className="max-h-40 min-h-16 text-sm"
        onChange={(event) => setCommentDraft(questId, event.target.value)}
        onKeyDown={(event) => {
          if (isSubmitShortcut(event)) {
            event.preventDefault()
            submit()
          }
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {trimmedLength >= COUNTER_THRESHOLD ? (
            <span
              aria-live="polite"
              className={cn('tabular-nums', isOverLimit && 'text-destructive')}
            >
              {trimmedLength}/{COMMENT_BODY_MAX_LENGTH}
            </span>
          ) : (
            // Texto estático y neutral: detectar la plataforma al renderizar
            // daría un HTML distinto en SSR y en el cliente (hydration mismatch).
            '⌘/Ctrl+Enter to send'
          )}
        </span>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          <SendHorizontal aria-hidden="true" />
          Comment
        </Button>
      </div>
    </form>
  )
}

/**
 * Aviso del pie: el último error de una mutación de comentarios de la quest y,
 * mientras haya textos de publicaciones fallidas guardados aparte, la acción de
 * recuperarlos (Restore) o descartar el más reciente (×).
 */
function CommentNotice({
  questId,
  error,
}: {
  questId: string
  error: string | null
}) {
  const unsent = useUnsentComments(questId)
  if (!error && unsent.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {unsent.length > 0 && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="flex-1">
            {unsent.length === 1
              ? 'Unsent comment'
              : `${unsent.length} unsent comments`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => restoreUnsentComment(questId)}
          >
            <RotateCcw aria-hidden="true" />
            Restore
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Discard unsent comment"
            onClick={() => discardUnsentComment(questId)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
