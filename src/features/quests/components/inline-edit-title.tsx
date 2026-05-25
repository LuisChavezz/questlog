/**
 * InlineEditTitle — edición en línea del título de una quest.
 * Al hacer clic, el título se convierte en un input de texto.
 * Confirma con Enter o al perder el foco; cancela con Escape.
 */
import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'

import { cn } from '#/lib/utils'

interface InlineEditTitleProps {
  value: string
  onSave: (newValue: string) => void
  className?: string
}

export function InlineEditTitle({ value, onSave, className }: InlineEditTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Enfocar y seleccionar el input al entrar en modo edición
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  // Sincronizar el draft con el valor externo (p.ej., rollback optimista)
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onSave(trimmed)
    }
    setEditing(false)
  }

  const cancel = () => {
    setDraft(value)
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
        className={cn(
          'w-full rounded border border-ring bg-background px-1.5 py-0.5',
          'text-sm font-medium text-foreground outline-none',
          'focus:ring-2 focus:ring-ring/50',
          className,
        )}
        maxLength={100}
        aria-label="Edit title"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={cn(
        'group flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5',
        'cursor-pointer text-left transition-colors hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
      aria-label={`Edit title: ${value}`}
    >
      <span className="truncate font-medium text-foreground">{value}</span>
      <Pencil
        className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
        aria-hidden="true"
      />
    </button>
  )
}
