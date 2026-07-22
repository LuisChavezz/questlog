/**
 * InlineEditTags — edición en línea de las etiquetas de una quest.
 * Muestra los badges de tags; al hacer clic se convierte en un input de texto
 * con valores separados por comas. Confirma con Enter/blur, cancela con Escape.
 */
import { Plus } from 'lucide-react'

import { cn } from '#/lib/utils'
import { Badge } from '#/components/ui/badge'
import { useInlineEdit } from '../hooks/use-inline-edit'

interface InlineEditTagsProps {
  value: string[]
  onSave: (newTags: string[]) => void
  /** Solo lectura: muestra las tags sin afordancia de edición */
  readOnly?: boolean
}

export function InlineEditTags({
  value,
  onSave,
  readOnly = false,
}: InlineEditTagsProps) {
  const {
    editing,
    draft,
    setDraft,
    fieldRef,
    startEditing,
    commit,
    handleKeyDown,
  } = useInlineEdit<string[], HTMLInputElement>({
    value,
    onSave,
    toDraft: (tags) => tags.join(', '),
    fromDraft: (text) =>
      text
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    // Igualdad por contenido: el array parseado siempre es una instancia nueva
    isEqual: (a, b) =>
      a.length === b.length && a.every((tag, i) => tag === b[i]),
  })

  // Solo lectura: mismos badges (o guion si no hay), sin botón de edición
  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-1 px-1 py-0.5 -mx-1">
        {value.length ? (
          value.map((tag) => (
            <Badge key={tag} variant="outline" className="py-0 text-xs">
              {tag}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </div>
    )
  }

  if (editing) {
    return (
      <input
        ref={fieldRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
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
      onClick={startEditing}
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
