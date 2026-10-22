// Mensaje de error de comentarios para la UI. Los errores que lanza nuestro
// servidor con un prefijo conocido ya están redactados para el usuario y se
// muestran tal cual; cualquier otro (un fallo de red como "Failed to fetch", un
// error inesperado del runtime o de validación) se sustituye por un mensaje en
// inglés propio de la acción, sin filtrar el texto técnico a la pantalla.
//
// Vive en el slice a propósito: el resto de la app sigue mostrando
// `error.message` directamente, y cambiar eso queda fuera de este alcance.

export type QuestCommentAction = 'post' | 'edit' | 'delete' | 'load'

// Prefijos con los que los handlers de comentarios (y los resolvers de auth que
// reutilizan) lanzan errores pensados para el usuario.
const USER_FACING_PREFIX = /^(Forbidden|Not Found|Conflict): /

const FALLBACK_MESSAGE: Record<QuestCommentAction, string> = {
  post: "Couldn't post your comment. Check your connection and try again.",
  edit: "Couldn't save your edit. Check your connection and try again.",
  delete: "Couldn't delete the comment. Check your connection and try again.",
  load: "Couldn't load comments. Check your connection and try again.",
}

export function getQuestCommentErrorMessage(
  error: unknown,
  action: QuestCommentAction,
): string {
  if (error instanceof Error && USER_FACING_PREFIX.test(error.message)) {
    return error.message
  }

  return FALLBACK_MESSAGE[action]
}
