/**
 * InlineEditTitle — edición en línea del título de una quest.
 * Al hacer clic, el título se convierte en un input de texto.
 * Confirma con Enter o al perder el foco; cancela con Escape.
 */
import { Pencil } from 'lucide-react'

import { cn } from '#/lib/utils'
import { useInlineEdit } from '../hooks/use-inline-edit'

interface InlineEditTitleProps {
  value: string
  onSave: (newValue: string) => void
  className?: string
  /** Solo lectura: muestra el título sin afordancia de edición */
  readOnly?: boolean
}

export function InlineEditTitle({
  value,
  onSave,
  className,
  readOnly = false,
}: InlineEditTitleProps) {
  const {
    editing,
    draft,
    setDraft,
    fieldRef,
    startEditing,
    commit,
    handleKeyDown,
  } = useInlineEdit<string, HTMLInputElement>({
    value,
    onSave,
    toDraft: (title) => title,
    fromDraft: (text) => text.trim(),
    // Un título vacío no se guarda — confirmar en blanco equivale a descartar
    canCommit: (title) => title !== '',
  })

  // Solo lectura: mismo texto, sin botón ni lápiz de edición
  if (readOnly) {
    return (
      <span
        className={cn(
          'block truncate px-1.5 py-0.5 -mx-1.5 font-medium text-foreground',
          className,
        )}
      >
        {value}
      </span>
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
        className={cn(
          'w-full rounded border border-ring bg-background px-1.5 py-0.5',
          'text-sm font-medium text-foreground outline-none',
          'focus:ring-2 focus:ring-ring/50',
          className,
        )}
        maxLength={100}
        autoComplete="off"
        aria-label="Edit title"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={cn(
        'group flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5',
        'cursor-pointer text-left transition-colors hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
      aria-label={`Edit title: ${value}`}
    >
      <span className="min-w-0 truncate font-medium text-foreground">
        {value}
      </span>
      <Pencil
        className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
        aria-hidden="true"
      />
    </button>
  )
}
