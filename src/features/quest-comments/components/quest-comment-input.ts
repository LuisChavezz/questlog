// Atributo que marca los campos de texto de comentarios (composer y editor
// inline). El drawer de detalle lo consulta en `onEscapeKeyDown` para que
// Escape dentro de ellos no cierre el drawer: perderías lo que estás escribiendo
// o editando. Mismo mecanismo que `QUEST_OPEN_TRIGGER_ATTR` para los clics.
export const QUEST_COMMENT_INPUT_ATTR = 'data-quest-comment-input'

/** ¿El evento viene de un campo de texto de comentarios? */
export function isQuestCommentInputEvent(event: Event) {
  const target = event.target
  return (
    target instanceof Element &&
    target.closest(`[${QUEST_COMMENT_INPUT_ATTR}]`) !== null
  )
}

/** ¿Es Ctrl+Enter (o Cmd+Enter en macOS)? El atajo de enviar/guardar. */
export function isSubmitShortcut(event: React.KeyboardEvent) {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey)
}
