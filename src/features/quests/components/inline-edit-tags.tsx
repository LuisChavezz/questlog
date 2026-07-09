/**
 * InlineEditTags — edición en línea de las etiquetas de una quest.
 * Muestra los badges de tags; al hacer clic se convierte en un input de texto
 * con valores separados por comas. Confirma con Enter/blur, cancela con Escape.
 */
import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

import { cn } from '#/lib/utils'
import { Badge } from '#/components/ui/badge'

interface InlineEditTagsProps {
  value: string[]
  onSave: (newTags: string[]) => void
}

export function InlineEditTags({ value, onSave }: InlineEditTagsProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value.join(', '))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  // Sincronizar el draft cuando el valor externo cambia (p.ej., rollback)
  useEffect(() => {
    if (!editing) setDraft(value.join(', '))
  }, [value, editing])

  const commit = () => {
    const newTags = draft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    // Solo guardar si el contenido cambió
    const changed =
      newTags.length !== value.length || newTags.some((t, i) => t !== value[i])

    if (changed) onSave(newTags)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(value.join(', '))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        placeholder="tag1, tag2, tag3"
        autoComplete="off"
        className={cn(
          'w-full rounded border border-ring bg-background px-1.5 py-0.5',
          'text-xs text-foreground outline-none',
          'focus:ring-2 focus:ring-ring/50',
        )}
        aria-label="Edit tags — comma-separated"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value.join(', '))
        setEditing(true)
      }}
      className={cn(
        'group flex w-full flex-wrap items-center gap-1 rounded px-1 py-0.5 -mx-1',
        'cursor-pointer text-left transition-colors hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
      aria-label="Edit tags"
    >
      {value.length ? (
        value.map((tag) => (
          <Badge key={tag} variant="outline" className="py-0 text-xs">
            {tag}
          </Badge>
        ))
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground/50 transition-colors group-hover:text-muted-foreground/70">
          <Plus className="size-3" aria-hidden="true" />
          Add tags
        </span>
      )}
    </button>
  )
}
