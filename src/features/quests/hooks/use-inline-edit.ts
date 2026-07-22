/**
 * useInlineEdit — máquina de estados compartida de los editores en línea
 * (InlineEditTitle, InlineEditTags, InlineEditDescription): clic para editar,
 * confirmar por tecla o blur, cancelar con Escape, enfocar al entrar en
 * edición y re-sincronizar el draft con el valor externo (p. ej. el rollback
 * de una mutación optimista).
 *
 * Antes cada editor llevaba su propia copia de esta lógica y ya habían
 * divergido en detalles sutiles (qué tecla confirma, si un valor vacío se
 * guarda o se descarta); centralizarla deja UNA implementación y convierte
 * esas diferencias en opciones explícitas. Cada componente conserva solo su
 * renderizado (input de una línea, lista de badges, textarea).
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

interface UseInlineEditOptions<TValue> {
  value: TValue
  onSave: (next: TValue) => void
  /** Serializa el valor externo al texto que edita el campo */
  toDraft: (value: TValue) => string
  /** Interpreta el draft al confirmar (trim, parseo CSV, …) */
  fromDraft: (draft: string) => TValue
  /**
   * Compara el valor interpretado con el externo para no guardar sin cambios.
   * Por defecto `Object.is` — suficiente para strings; las tags (array)
   * necesitan la suya.
   */
  isEqual?: (a: TValue, b: TValue) => boolean
  /**
   * Veta confirmaciones inválidas (p. ej. un título vacío): si devuelve
   * `false` no se guarda, pero SÍ se sale del modo edición — mismo
   * comportamiento que descartar.
   */
  canCommit?: (next: TValue) => boolean
  /**
   * Qué hacer con la selección al enfocar: `'select-all'` (campos cortos que
   * se suelen reemplazar enteros) o `'cursor-end'` (textos largos que se
   * suelen continuar). Por defecto `'select-all'`.
   */
  focusMode?: 'select-all' | 'cursor-end'
  /**
   * Tecla que confirma: `'enter'` a secas, o `'mod-enter'` (Cmd/Ctrl+Enter)
   * para campos multilínea donde Enter inserta un salto. Por defecto
   * `'enter'`. Escape siempre cancela.
   */
  commitKey?: 'enter' | 'mod-enter'
}

interface UseInlineEditResult<
  TElement extends HTMLInputElement | HTMLTextAreaElement,
> {
  editing: boolean
  draft: string
  setDraft: (draft: string) => void
  /** Ref para el input/textarea del modo edición — el hook lo enfoca al entrar */
  fieldRef: RefObject<TElement | null>
  startEditing: () => void
  commit: () => void
  cancel: () => void
  /** onKeyDown ya cableado según `commitKey` (confirmar) y Escape (cancelar) */
  handleKeyDown: (event: KeyboardEvent<TElement>) => void
}

export function useInlineEdit<
  TValue,
  TElement extends HTMLInputElement | HTMLTextAreaElement,
>({
  value,
  onSave,
  toDraft,
  fromDraft,
  isEqual = Object.is,
  canCommit = () => true,
  focusMode = 'select-all',
  commitKey = 'enter',
}: UseInlineEditOptions<TValue>): UseInlineEditResult<TElement> {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => toDraft(value))
  const fieldRef = useRef<TElement>(null)

  // Enfocar el campo al entrar en modo edición
  useEffect(() => {
    if (!editing) return

    const el = fieldRef.current
    if (!el) return

    el.focus()
    if (focusMode === 'select-all') {
      el.select()
    } else {
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editing, focusMode])

  // Sincronizar el draft con el valor externo (p. ej., rollback optimista).
  // `toDraft` queda fuera de las dependencias a propósito: los callers lo
  // pasan como arrow inline (identidad nueva en cada render) y solo importa
  // su resultado sobre `value`, no su identidad.
  useEffect(() => {
    if (!editing) setDraft(toDraft(value))
  }, [value, editing])

  const commit = () => {
    const next = fromDraft(draft)
    if (canCommit(next) && !isEqual(next, value)) {
      onSave(next)
    }
    setEditing(false)
  }

  const cancel = () => {
    setDraft(toDraft(value))
    setEditing(false)
  }

  const startEditing = () => {
    setDraft(toDraft(value))
    setEditing(true)
  }

  const handleKeyDown = (event: KeyboardEvent<TElement>) => {
    const isCommitKey =
      event.key === 'Enter' &&
      (commitKey === 'enter' || event.metaKey || event.ctrlKey)

    if (isCommitKey) {
      event.preventDefault()
      commit()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  return {
    editing,
    draft,
    setDraft,
    fieldRef,
    startEditing,
    commit,
    cancel,
    handleKeyDown,
  }
}
