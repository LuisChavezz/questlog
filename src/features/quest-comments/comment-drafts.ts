// Borradores del composer de comentarios, uno por quest, SOLO en memoria: un
// `Map` a nivel de módulo. Sobrevive a cerrar el drawer y a cambiar de quest
// (el composer se remonta por quest y lo relee), y se pierde al recargar la
// página. No es estado global de UI —no va en Zustand— ni se persiste.
//
// Al publicar, el composer vacía el borrador en el acto (el comentario ya se ve
// como optimista en el hilo) y, si el servidor lo rechaza, el hook de creación
// lo restaura: el efecto neto es que el borrador solo desaparece si la
// publicación tuvo éxito, sin que reaparezca mientras está en vuelo.
const drafts = new Map<string, string>()

export function getCommentDraft(questId: string): string {
  return drafts.get(questId) ?? ''
}

export function setCommentDraft(questId: string, value: string) {
  if (value === '') {
    drafts.delete(questId)
  } else {
    drafts.set(questId, value)
  }
}

/**
 * Devuelve al borrador el texto de una publicación fallida, salvo que el
 * usuario ya haya empezado a escribir otro mientras estaba en vuelo: ese no se
 * pisa. Corre en el hook (no en el componente) para que funcione aunque el
 * composer se haya desmontado al cambiar de quest.
 */
export function restoreCommentDraft(questId: string, body: string) {
  if (getCommentDraft(questId) === '') {
    drafts.set(questId, body)
  }
}
