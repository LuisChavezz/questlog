/**
 * QuestCommentComposer — caja para publicar un comentario en una quest de
 * guild. Enter inserta un salto de línea y Ctrl/Cmd+Enter publica. El borrador
 * vive en memoria por quest (`comment-drafts.ts`): sobrevive a cerrar el drawer
 * o cambiar de quest y se pierde al recargar.
 */
import { useState } from 'react'
import { SendHorizontal } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'
import type { QuestCommentAuthor } from '../api/quest-comment-item'
import { getCommentDraft, setCommentDraft } from '../comment-drafts'
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

interface QuestCommentComposerProps {
  questId: string
  // Usuario actual, para pintar el comentario optimista con su nombre y avatar
  currentAuthor: QuestCommentAuthor | null
}

export function QuestCommentComposer({
  questId,
  currentAuthor,
}: QuestCommentComposerProps) {
  // Se lee una vez al montar: el contenido del drawer se remonta por quest
  // (`key={quest.id}`), así que cada quest arranca con SU borrador.
  const [draft, setDraft] = useState(() => getCommentDraft(questId))
  const [error, setError] = useState<string | null>(null)
  const createComment = useCreateQuestComment(questId, currentAuthor)

  const trimmedLength = draft.trim().length
  const canSubmit = commentBodySchema.safeParse(draft).success
  const isOverLimit = trimmedLength > COMMENT_BODY_MAX_LENGTH

  const changeDraft = (value: string) => {
    setDraft(value)
    setCommentDraft(questId, value)
  }

  const submit = () => {
    const parsed = commentBodySchema.safeParse(draft)
    if (!parsed.success) return

    setError(null)
    // Se vacía en el acto: el comentario ya se ve como optimista en el hilo. Si
    // el servidor lo rechaza, el hook devuelve el texto al borrador.
    changeDraft('')
    createComment.mutate(parsed.data, {
      onError: (mutationError) => {
        setError(mutationError.message)
        setDraft(getCommentDraft(questId))
      },
    })
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
      <Textarea
        {...{ [QUEST_COMMENT_INPUT_ATTR]: 'true' }}
        aria-label="Write a comment"
        placeholder="Write a comment…"
        value={draft}
        aria-invalid={isOverLimit || undefined}
        className="max-h-40 min-h-16 text-sm"
        onChange={(event) => changeDraft(event.target.value)}
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
            'Ctrl+Enter to send'
          )}
        </span>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          <SendHorizontal aria-hidden="true" />
          Comment
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
