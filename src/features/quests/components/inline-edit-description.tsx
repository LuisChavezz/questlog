/**
 * InlineEditDescription — edición en línea de la descripción de una quest.
 * Al hacer clic, el texto se convierte en un textarea auto-expandible.
 * Confirma con Cmd/Ctrl+Enter o al perder el foco; cancela con Escape.
 */
import { Pencil } from 'lucide-react'

import { cn } from '#/lib/utils'
import { Textarea } from '#/components/ui/textarea'
import { useInlineEdit } from '../hooks/use-inline-edit'

interface InlineEditDescriptionProps {
  value: string | null
  onSave: (newValue: string) => void
  className?: string
  /** Solo lectura: muestra la descripción sin afordancia de edición */
  readOnly?: boolean
}

export function InlineEditDescription({
  value,
  onSave,
  className,
  readOnly = false,
}: InlineEditDescriptionProps) {
  const {
    editing,
    draft,
    setDraft,
    fieldRef,
    startEditing,
    commit,
    handleKeyDown,
  } = useInlineEdit<string, HTMLTextAreaElement>({
    // `null` (sin descripción) se normaliza a '' — el handler del servidor
    // vuelve a convertir '' en null al guardar
    value: value ?? '',
    onSave,
    toDraft: (description) => description,
    fromDraft: (text) => text.trim(),
    // Texto largo: al reabrir se suele continuar, no reemplazar entero
    focusMode: 'cursor-end',
    // Enter inserta salto de línea; confirma Cmd/Ctrl+Enter
    commitKey: 'mod-enter',
  })

  // Solo lectura: mismo texto (o mensaje vacío), sin afordancia de edición
  if (readOnly) {
    return value ? (
      <p
        className={cn('whitespace-pre-wrap text-sm text-foreground', className)}
      >
        {value}
      </p>
    ) : (
      <p className={cn('text-sm text-muted-foreground/60', className)}>
        No description added yet.
      </p>
    )
  }

  if (editing) {
    return (
      <Textarea
        ref={fieldRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder="Add description"
        maxLength={500}
        rows={3}
        className={cn('resize-none text-sm', className)}
        aria-label="Edit description"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={cn(
        'group flex w-full items-start gap-1.5 rounded px-1.5 py-0.5 -mx-1.5',
        'cursor-pointer text-left transition-colors hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
      aria-label={value ? `Edit description: ${value}` : 'Add description'}
    >
      {value ? (
        <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-foreground">
          {value}
        </span>
      ) : (
        <span className="flex-1 text-sm text-muted-foreground/60 transition-colors group-hover:text-muted-foreground/80">
          Add description
        </span>
      )}
      <Pencil
        className="mt-0.5 size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
        aria-hidden="true"
      />
    </button>
  )
}
