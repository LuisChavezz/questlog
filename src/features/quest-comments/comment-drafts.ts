// Estado de UI del hilo de comentarios, por quest y SOLO en memoria: el borrador
// del composer y el último error de una mutación de comentarios. Vive en `Map`s
// a nivel de módulo —no en Zustand ni persistido—, así que sobrevive a cerrar el
// drawer y a cambiar de quest, y se pierde al recargar la página.
//
// Es un store externo con suscripción (`useSyncExternalStore`) y no estado de
// React porque lo escriben los hooks de mutación desde su `onError` de nivel de
// hook, que corre para CADA mutación aunque el componente que la lanzó ya se
// haya desmontado o haya lanzado otra después (los callbacks por llamada de
// `mutate` solo corren para la última). Así cualquier composer o hilo montado
// para esa quest —sea la misma instancia o una nueva— refleja el resultado.
import { useCallback, useSyncExternalStore } from 'react'

const drafts = new Map<string, string>()
const errors = new Map<string, string>()
const listeners = new Map<string, Set<() => void>>()

function notify(questId: string) {
  for (const listener of listeners.get(questId) ?? []) listener()
}

function subscribe(questId: string, listener: () => void) {
  const questListeners = listeners.get(questId) ?? new Set()
  questListeners.add(listener)
  listeners.set(questId, questListeners)

  return () => {
    questListeners.delete(listener)
    if (questListeners.size === 0) listeners.delete(questId)
  }
}

// ─── Borrador ─────────────────────────────────────────────────────────────────

export function getCommentDraft(questId: string): string {
  return drafts.get(questId) ?? ''
}

export function setCommentDraft(questId: string, value: string) {
  if (value === '') {
    drafts.delete(questId)
  } else {
    drafts.set(questId, value)
  }
  notify(questId)
}

/**
 * Devuelve al borrador el texto de una publicación fallida, SOLO si el borrador
 * está vacío: si el usuario ya empezó a escribir otro mientras la publicación
 * estaba en vuelo, ese texto no se pisa. Como el composer lee de este mismo
 * store, restaurar aquí también rellena el textarea si está montado.
 *
 * @returns si el texto se restauró.
 */
export function restoreCommentDraft(questId: string, body: string): boolean {
  if (getCommentDraft(questId) !== '') return false

  setCommentDraft(questId, body)
  return true
}

// ─── Error de la última mutación ──────────────────────────────────────────────

export function getCommentError(questId: string): string | null {
  return errors.get(questId) ?? null
}

/** `null` limpia el error (al lanzar una mutación nueva o al descartarlo). */
export function setCommentError(questId: string, message: string | null) {
  if (message === null) {
    errors.delete(questId)
  } else {
    errors.set(questId, message)
  }
  notify(questId)
}

// ─── Hooks de lectura ─────────────────────────────────────────────────────────

function useQuestCommentsStore<T>(questId: string, read: (id: string) => T) {
  const subscribeToQuest = useCallback(
    (listener: () => void) => subscribe(questId, listener),
    [questId],
  )
  const getSnapshot = () => read(questId)

  // Mismo snapshot en servidor y cliente: el borrador y el error solo existen
  // en el navegador, así que en SSR siempre parten vacíos.
  return useSyncExternalStore(subscribeToQuest, getSnapshot, getSnapshot)
}

export function useCommentDraft(questId: string) {
  return useQuestCommentsStore(questId, getCommentDraft)
}

export function useCommentError(questId: string) {
  return useQuestCommentsStore(questId, getCommentError)
}
