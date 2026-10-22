/**
 * QuestCommentsThread — hilo plano de comentarios de una quest de guild, de
 * más antiguo a más reciente (el más nuevo queda junto al composer, que vive en
 * el pie del drawer). Carga los 20 más recientes y "Load older" trae los 20
 * anteriores a cada cursor. Los errores de editar/borrar no se pintan aquí ni
 * en el diálogo de confirmación: los publica cada hook en el store de la quest y
 * los muestra el composer, en el pie fijo del drawer.
 */
import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import {
  flattenQuestCommentPages,
  questCommentsInfiniteQueryOptions,
} from '../api/quest-comments-query-options'
import { useDeleteQuestComment } from '../hooks/use-delete-quest-comment'
import { useUpdateQuestComment } from '../hooks/use-update-quest-comment'
import { QuestCommentEntry } from './quest-comment-entry'

function ThreadSkeleton() {
  return (
    <div aria-label="Loading comments" className="flex flex-col gap-4">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="flex gap-2.5">
          <div className="size-6 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3.5 w-1/3 animate-pulse rounded-md bg-muted" />
            <div className="h-3.5 w-full animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function QuestCommentsThread({ questId }: { questId: string }) {
  const {
    data,
    isPending,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(questCommentsInfiniteQueryOptions(questId))
  const updateComment = useUpdateQuestComment(questId)
  const deleteComment = useDeleteQuestComment(questId)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  // Destino estable del foco al cerrar el diálogo de borrado (ver abajo).
  const threadRef = useRef<HTMLDivElement>(null)

  const comments = data ? flattenQuestCommentPages(data) : []
  const newest = comments.at(-1)

  // Al publicar, el comentario optimista aparece al final del hilo, que vive
  // dentro del cuerpo scrolleable del drawer: se trae a la vista para que quien
  // acaba de escribir vea su comentario junto al composer.
  const endRef = useRef<HTMLDivElement>(null)
  const newestPendingId = newest?.pending ? newest.id : null
  useEffect(() => {
    if (newestPendingId) {
      endRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [newestPendingId])

  if (isPending) {
    return <ThreadSkeleton />
  }

  // Solo sin datos: si falla un refetch en segundo plano (p. ej. el que lanza
  // cada mutación al asentarse), se sigue mostrando el hilo ya cargado.
  if (!data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    )
  }

  return (
    <div
      ref={threadRef}
      tabIndex={-1}
      className="flex flex-col gap-4 outline-none"
    >
      {hasNextPage && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="self-center text-muted-foreground"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load older'}
        </Button>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Start the discussion below.
        </p>
      ) : (
        comments.map((comment) => (
          <QuestCommentEntry
            key={comment.id}
            comment={comment}
            onSaveEdit={(body) =>
              updateComment.mutate({ commentId: comment.id, body })
            }
            onRequestDelete={() => setPendingDeleteId(comment.id)}
          />
        ))
      )}

      <div ref={endRef} />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
        variant="destructive"
        title="Delete comment?"
        description="This comment will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        // El borrado optimista retira el comentario —y con él el botón Delete
        // que abrió el diálogo—, así que devolverle el foco al cerrar lo
        // mandaría a un nodo desmontado y el foco acabaría en <body>, fuera del
        // drawer. Se lleva al contenedor del hilo, que sigue montado.
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          threadRef.current?.focus()
        }}
        onConfirm={() => {
          if (!pendingDeleteId) return
          // Sin `await`: el borrado es optimista, así que el diálogo se cierra
          // en el acto; un fallo lo publica el hook y lo pinta el composer.
          deleteComment.mutate({ commentId: pendingDeleteId })
        }}
      />
    </div>
  )
}
