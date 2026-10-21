/**
 * QuestCommentEntry — un comentario del hilo: avatar, autor, tiempo relativo,
 * marca "edited", cuerpo en texto plano (respetando saltos de línea) y las
 * acciones Edit/Delete solo cuando el servidor dice que el observador puede.
 * Edit cambia el cuerpo por un editor inline (Ctrl/Cmd+Enter guarda, Escape
 * cancela sin cerrar el drawer).
 */
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Pencil, Trash2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { UserAvatar } from '#/components/user-avatar'
import { dateFormatter } from '#/lib/format-date'
import { cn } from '#/lib/utils'
import type { QuestCommentCacheItem } from '../api/quest-comments-query-options'
import { commentBodySchema } from '../schemas/quest-comment-schemas'
import {
  isSubmitShortcut,
  QUEST_COMMENT_INPUT_ATTR,
} from './quest-comment-input'

interface QuestCommentEntryProps {
  comment: QuestCommentCacheItem
  onSaveEdit: (body: string) => void
  onRequestDelete: () => void
}

export function QuestCommentEntry({
  comment,
  onSaveEdit,
  onRequestDelete,
}: QuestCommentEntryProps) {
  const [editDraft, setEditDraft] = useState<string | null>(null)
  const isEditing = editDraft !== null
  const authorName = comment.author?.name ?? 'Unknown user'
  // Sin acciones mientras el comentario optimista no exista en el servidor.
  const showActions =
    !comment.pending && !isEditing && (comment.canEdit || comment.canDelete)

  const saveEdit = () => {
    if (editDraft === null) return
    const parsed = commentBodySchema.safeParse(editDraft)
    if (!parsed.success) return

    setEditDraft(null)
    // Sin cambios tras recortar: nada que enviar (el servidor tampoco marcaría
    // "edited").
    if (parsed.data !== comment.body) {
      onSaveEdit(parsed.data)
    }
  }

  return (
    <article
      aria-label={`Comment by ${authorName}`}
      className={cn(
        'group/comment flex gap-2.5',
        comment.pending && 'opacity-60',
      )}
      aria-busy={comment.pending || undefined}
    >
      <UserAvatar
        name={comment.author?.name}
        image={comment.author?.image}
        avatarId={comment.author?.avatarId}
        initials={comment.author?.initials}
        size="sm"
        className="mt-0.5 shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="truncate font-medium text-foreground">
            {authorName}
          </span>
          <time
            dateTime={new Date(comment.createdAt).toISOString()}
            title={dateFormatter.format(new Date(comment.createdAt))}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {comment.pending
              ? 'Posting…'
              : formatDistanceToNow(new Date(comment.createdAt), {
                  addSuffix: true,
                })}
          </time>
          {comment.editedAt && (
            <span
              className="shrink-0 text-xs text-muted-foreground"
              title={`Edited ${dateFormatter.format(new Date(comment.editedAt))}`}
            >
              · edited
            </span>
          )}

          {showActions && (
            <div className="ml-auto flex shrink-0 items-center opacity-0 transition-opacity group-hover/comment:opacity-100 group-focus-within/comment:opacity-100">
              {comment.canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Edit comment"
                  className="text-muted-foreground"
                  onClick={() => setEditDraft(comment.body)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              )}
              {comment.canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete comment"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={onRequestDelete}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              {...{ [QUEST_COMMENT_INPUT_ATTR]: 'true' }}
              aria-label="Edit comment"
              value={editDraft}
              autoFocus
              className="max-h-60 min-h-16 text-sm"
              onChange={(event) => setEditDraft(event.target.value)}
              onKeyDown={(event) => {
                if (isSubmitShortcut(event)) {
                  event.preventDefault()
                  saveEdit()
                } else if (event.key === 'Escape') {
                  // El drawer ignora este Escape (ver QUEST_COMMENT_INPUT_ATTR):
                  // aquí solo cancela la edición.
                  setEditDraft(null)
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setEditDraft(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="xs"
                disabled={!commentBodySchema.safeParse(editDraft).success}
                onClick={saveEdit}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm break-words whitespace-pre-wrap text-foreground">
            {comment.body}
          </p>
        )}
      </div>
    </article>
  )
}
