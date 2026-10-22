// @vitest-environment node
// Fija qué ve el usuario cuando falla una acción de comentarios: los errores del
// servidor con prefijo conocido pasan tal cual; cualquier otro (red, runtime)
// se sustituye por un mensaje propio de la acción, sin el texto técnico.
import { describe, expect, it } from 'vitest'

import { getQuestCommentErrorMessage } from './comment-error-message'
import type { QuestCommentAction } from './comment-error-message'

const ACTIONS: QuestCommentAction[] = ['post', 'edit', 'delete', 'load']

const FALLBACKS: Record<QuestCommentAction, string> = {
  post: "Couldn't post your comment. Check your connection and try again.",
  edit: "Couldn't save your edit. Check your connection and try again.",
  delete: "Couldn't delete the comment. Check your connection and try again.",
  load: "Couldn't load comments. Check your connection and try again.",
}

describe('getQuestCommentErrorMessage', () => {
  it.each(ACTIONS)(
    '%s: los prefijos conocidos del servidor pasan tal cual',
    (action) => {
      for (const message of [
        'Forbidden: you can only delete your own comments',
        'Not Found: quest not found',
        'Conflict: the comment changed while saving — please refresh and try again',
      ]) {
        expect(getQuestCommentErrorMessage(new Error(message), action)).toBe(
          message,
        )
      }
    },
  )

  it.each(ACTIONS)(
    '%s: un fallo de red da el mensaje de la acción',
    (action) => {
      expect(
        getQuestCommentErrorMessage(new TypeError('Failed to fetch'), action),
      ).toBe(FALLBACKS[action])
    },
  )

  it.each(ACTIONS)(
    '%s: errores inesperados o sin forma de Error tampoco se filtran',
    (action) => {
      expect(
        getQuestCommentErrorMessage(
          new Error('Unexpected token < in JSON'),
          action,
        ),
      ).toBe(FALLBACKS[action])
      expect(getQuestCommentErrorMessage('boom', action)).toBe(
        FALLBACKS[action],
      )
    },
  )

  it('un prefijo a mitad del texto no cuenta como mensaje del servidor', () => {
    expect(
      getQuestCommentErrorMessage(
        new Error('Request failed. Forbidden: x'),
        'post',
      ),
    ).toBe(FALLBACKS.post)
  })
})
