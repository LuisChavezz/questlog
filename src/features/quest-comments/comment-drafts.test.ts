// @vitest-environment node
// Fija las reglas del store por quest de borradores y textos no enviados: un
// texto de una publicación fallida nunca se pierde (vuelve al composer vacío o
// queda apartado), Restore intercambia sin descartar, × descarta solo el que se
// muestra, y cada quest tiene lo suyo.
import { afterEach, describe, expect, it } from 'vitest'

import {
  discardUnsentComment,
  getCommentDraft,
  getUnsentComments,
  keepFailedComment,
  restoreUnsentComment,
  setCommentDraft,
} from './comment-drafts'

const QUEST = 'quest-a'
const OTHER_QUEST = 'quest-b'

afterEach(() => {
  for (const questId of [QUEST, OTHER_QUEST]) {
    setCommentDraft(questId, '')
    while (getUnsentComments(questId).length > 0) discardUnsentComment(questId)
  }
})

describe('keepFailedComment', () => {
  it('con el composer vacío, el texto fallido vuelve al borrador', () => {
    expect(keepFailedComment(QUEST, 'Failed text')).toBe('draft')
    expect(getCommentDraft(QUEST)).toBe('Failed text')
    expect(getUnsentComments(QUEST)).toEqual([])
  })

  it('con el composer ocupado, el texto fallido queda apartado sin pisarlo', () => {
    setCommentDraft(QUEST, 'Typing something new')

    expect(keepFailedComment(QUEST, 'Failed text')).toBe('unsent')
    expect(getCommentDraft(QUEST)).toBe('Typing something new')
    expect(getUnsentComments(QUEST)).toEqual(['Failed text'])
  })

  it('varios fallos se acumulan, el más reciente al final', () => {
    setCommentDraft(QUEST, 'Typing')

    keepFailedComment(QUEST, 'First failure')
    keepFailedComment(QUEST, 'Second failure')

    expect(getUnsentComments(QUEST)).toEqual([
      'First failure',
      'Second failure',
    ])
  })
})

describe('restoreUnsentComment', () => {
  it('con el composer vacío, lleva el más reciente al borrador', () => {
    setCommentDraft(QUEST, 'Typing')
    keepFailedComment(QUEST, 'Failed text')
    setCommentDraft(QUEST, '')

    restoreUnsentComment(QUEST)

    expect(getCommentDraft(QUEST)).toBe('Failed text')
    expect(getUnsentComments(QUEST)).toEqual([])
  })

  it('con el composer ocupado, intercambia: lo escrito pasa a no enviados', () => {
    setCommentDraft(QUEST, 'Typing')
    keepFailedComment(QUEST, 'Failed text')

    restoreUnsentComment(QUEST)

    expect(getCommentDraft(QUEST)).toBe('Failed text')
    expect(getUnsentComments(QUEST)).toEqual(['Typing'])

    // Un segundo Restore deshace el intercambio: nada se ha perdido.
    restoreUnsentComment(QUEST)
    expect(getCommentDraft(QUEST)).toBe('Typing')
    expect(getUnsentComments(QUEST)).toEqual(['Failed text'])
  })

  it('sin no enviados no hace nada', () => {
    setCommentDraft(QUEST, 'Typing')

    restoreUnsentComment(QUEST)

    expect(getCommentDraft(QUEST)).toBe('Typing')
  })
})

describe('discardUnsentComment', () => {
  it('descarta solo el más reciente', () => {
    setCommentDraft(QUEST, 'Typing')
    keepFailedComment(QUEST, 'First failure')
    keepFailedComment(QUEST, 'Second failure')

    discardUnsentComment(QUEST)

    expect(getUnsentComments(QUEST)).toEqual(['First failure'])
    expect(getCommentDraft(QUEST)).toBe('Typing')
  })
})

describe('aislamiento por quest', () => {
  it('los no enviados y borradores de una quest no tocan los de otra', () => {
    setCommentDraft(QUEST, 'Typing in A')
    keepFailedComment(QUEST, 'Failed in A')

    expect(getUnsentComments(OTHER_QUEST)).toEqual([])
    expect(keepFailedComment(OTHER_QUEST, 'Failed in B')).toBe('draft')

    restoreUnsentComment(OTHER_QUEST)
    expect(getCommentDraft(OTHER_QUEST)).toBe('Failed in B')
    expect(getUnsentComments(QUEST)).toEqual(['Failed in A'])
    expect(getCommentDraft(QUEST)).toBe('Typing in A')
  })

  it('la lista vacía es estable entre lecturas (snapshot de useSyncExternalStore)', () => {
    expect(getUnsentComments(QUEST)).toBe(getUnsentComments(QUEST))
  })
})
