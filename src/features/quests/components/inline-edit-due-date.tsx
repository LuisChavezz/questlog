/**
 * InlineEditDueDate — edición en línea de la fecha de vencimiento de una quest.
 */
import { useEffect, useId, useState } from 'react'
import { Calendar, Pencil } from 'lucide-react'

import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import {
  formatQuestDueDate,
  getQuestDateInputValue,
  getTodayDateString,
  isQuestDueDateOverdue,
  questDueDateSchema,
} from '../schemas/quest-schemas'

/**
 * Abre el date picker nativo del navegador si el elemento lo soporta.
 * Necesario porque autoFocus no siempre dispara el picker en todos los browsers.
 */
function openDatePicker(target: HTMLInputElement) {
  if ('showPicker' in target) {
    target.showPicker()
  }
}

interface InlineEditDueDateProps {
  /** Fecha de vencimiento actual de la quest. Null si no tiene fecha asignada. */
  value: Date | null
  /** Callback invocado con el nuevo valor YYYY-MM-DD al confirmar. '' borra la fecha. */
  onSave: (newValue: string) => void
  /** Solo lectura: muestra la fecha sin afordancia de edición */
  readOnly?: boolean
}

export function InlineEditDueDate({
  value,
  onSave,
  readOnly = false,
}: InlineEditDueDateProps) {
  // false = modo lectura; true = modo edición
  const [editing, setEditing] = useState(false)
  // Valor del input en formato YYYY-MM-DD mientras el usuario edita
  const [draft, setDraft] = useState(getQuestDateInputValue(value))
  // Mensaje de error de validación, o null si el valor es válido
  const [error, setError] = useState<string | null>(null)
  // ID único para aria-describedby cuando hay mensaje de error visible
  const errorId = useId()

  // String YYYY-MM-DD que refleja la prop `value` en todo momento
  const currentValue = getQuestDateInputValue(value)
  const isOverdue = isQuestDueDateOverdue(value)
  // Fecha mínima para el picker: hoy (impide elegir fechas pasadas)
  const minDueDate = getTodayDateString()

  // Sincronizar el draft con el valor externo cuando no está en edición.
  // Garantiza que un rollback optimista se refleje correctamente en el editor.
  useEffect(() => {
    if (!editing) {
      setDraft(currentValue)
      setError(null)
    }
  }, [currentValue, editing])

  /**
   * Valida el draft con el esquema compartido.
   * Actualiza el estado de error y retorna true si el valor es válido.
   */
  const validate = (nextValue: string) => {
    const result = questDueDateSchema.safeParse(nextValue)

    if (result.success) {
      setError(null)
      return true
    }

    setError(result.error.issues[0]?.message ?? 'Invalid due date')
    return false
  }

  /**
   * Confirma la edición: valida, llama a onSave si el valor cambió y cierra el editor.
   * Si la validación falla, mantiene el editor abierto y re-enfoca el input.
   */
  const commit = (target?: HTMLInputElement) => {
    if (!validate(draft)) {
      if (target) {
        target.focus()
        openDatePicker(target)
      }

      return
    }

    if (draft !== currentValue) {
      onSave(draft)
    }

    setEditing(false)
  }

  /** Descarta los cambios y restaura el draft al valor actual de la prop. */
  const cancel = () => {
    setDraft(currentValue)
    setError(null)
    setEditing(false)
  }

  // ─── Modo solo lectura ───────────────────────────────────────────────────────
  // Mismo ícono + texto (con coloreado de vencida) pero sin botón ni lápiz.

  if (readOnly) {
    return (
      <span className="flex items-center gap-1.5 px-1.5 py-0.5 -mx-1.5">
        <Calendar
          className={cn(
            'size-3.5 shrink-0',
            currentValue
              ? isOverdue
                ? 'text-destructive'
                : 'text-muted-foreground'
              : 'text-muted-foreground/50',
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            'min-w-0 truncate text-sm tabular-nums',
            currentValue
              ? isOverdue
                ? 'text-destructive'
                : 'text-muted-foreground'
              : 'text-muted-foreground/50',
          )}
        >
          {value ? formatQuestDueDate(value) : '—'}
        </span>
      </span>
    )
  }

  // ─── Modo edición ────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          type="date"
          min={minDueDate}
          value={draft}
          autoFocus
          onChange={(event) => {
            const nextValue = event.target.value
            setDraft(nextValue)
            // Revalidar en tiempo real cuando ya hay un error visible
            // para que el feedback desaparezca en cuanto el usuario corrija la fecha
            if (error) {
              validate(nextValue)
            }
          }}
          onBlur={(event) => commit(event.currentTarget)}
          onFocus={(event) => openDatePicker(event.currentTarget)}
          onClick={(event) => openDatePicker(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit(event.currentTarget)
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              cancel()
            }
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-8 px-2 text-xs tabular-nums"
        />
        {error && (
          <p id={errorId} className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  // ─── Modo lectura ────────────────────────────────────────────────────────────

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(currentValue)
        setError(null)
        setEditing(true)
      }}
      className={cn(
        'group flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5',
        'cursor-pointer text-left transition-colors hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
      aria-label={currentValue ? `Edit due date: ${currentValue}` : 'Set due date'}
    >
      <Calendar
        className={cn(
          'size-3.5 shrink-0',
          currentValue
            ? isOverdue
              ? 'text-destructive'
              : 'text-muted-foreground'
            : 'text-muted-foreground/50',
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'min-w-0 truncate text-sm tabular-nums',
          currentValue
            ? isOverdue
              ? 'text-destructive'
              : 'text-muted-foreground'
            : 'text-muted-foreground/50',
        )}
      >
        {/* Formato legible: Today / Tomorrow / Next Monday / Jun 15, 2026 */}
        {value ? formatQuestDueDate(value) : 'Set date'}
      </span>
      <Pencil
        className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
        aria-hidden="true"
      />
    </button>
  )
}