// Estado de UI del hilo de comentarios, por quest y SOLO en memoria: el borrador
// del composer, los textos de publicaciones fallidas que no cupieron en él
// ("no enviados") y el último error de una mutación de comentarios. Vive en `Map`s
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
// Pila por quest (el último es el más reciente). Se sustituye el array entero en
// cada cambio, nunca se muta, para que `useSyncExternalStore` vea un snapshot
// nuevo solo cuando de verdad cambia.
const unsent = new Map<string, readonly string[]>()
const errors = new Map<string, string>()
const NO_UNSENT: readonly string[] = []
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

// ─── Textos no enviados ───────────────────────────────────────────────────────

export function getUnsentComments(questId: string): readonly string[] {
  return unsent.get(questId) ?? NO_UNSENT
}

function setUnsentComments(questId: string, texts: readonly string[]) {
  if (texts.length === 0) {
    unsent.delete(questId)
  } else {
    unsent.set(questId, texts)
  }
  notify(questId)
}

/**
 * Guarda el texto de una publicación fallida sin perderlo nunca. Si el borrador
 * está vacío, vuelve al composer (que lee de este mismo store, así que también
 * rellena el textarea si está montado). Si el usuario ya escribió otra cosa
 * mientras la publicación estaba en vuelo, ese texto no se pisa: el fallido se
 * apila en los no enviados de la quest, desde donde se puede restaurar.
 *
 * @returns dónde quedó el texto.
 */
export function keepFailedComment(
  questId: string,
  body: string,
): 'draft' | 'unsent' {
  if (getCommentDraft(questId) === '') {
    setCommentDraft(questId, body)
    return 'draft'
  }

  setUnsentComments(questId, [...getUnsentComments(questId), body])
  return 'unsent'
}

/**
 * Lleva al composer el no enviado más reciente. Si el composer tiene texto, ese
 * texto pasa a los no enviados (como el más reciente) en vez de perderse: es un
 * intercambio, nunca un descarte.
 */
export function restoreUnsentComment(questId: string) {
  const texts = getUnsentComments(questId)
  const latest = texts.at(-1)
  if (latest === undefined) return

  const remaining = texts.slice(0, -1)
  const current = getCommentDraft(questId)
  setUnsentComments(
    questId,
    current === '' ? remaining : [...remaining, current],
  )
  setCommentDraft(questId, latest)
}

/** Descarta el no enviado que se muestra (el más reciente). */
export function discardUnsentComment(questId: string) {
  setUnsentComments(questId, getUnsentComments(questId).slice(0, -1))
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

export function useUnsentComments(questId: string) {
  return useQuestCommentsStore(questId, getUnsentComments)
}

export function useCommentError(questId: string) {
  return useQuestCommentsStore(questId, getCommentError)
}
