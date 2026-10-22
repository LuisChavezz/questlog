// @vitest-environment jsdom
// Fija el comportamiento optimista de useCreateQuestComment sobre la caché
// infinita del hilo: el comentario entra al principio de la página 0 (la más
// reciente) marcado como pendiente, la fila del servidor lo sustituye al volver,
// un error retira solo ese comentario, devuelve el texto al borrador y publica
// el error de la quest —también cuando se solapan dos publicaciones—, y al
// asentarse solo se invalida `['quest-comments', questId]`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import {
  discardUnsentComment,
  getCommentDraft,
  getUnsentComments,
  getCommentError,
  setCommentDraft,
  setCommentError,
} from '../comment-drafts'
import { useCreateQuestComment } from './use-create-quest-comment'
import {
  createTestQueryClient,
  makeCache,
  makeComment,
  QUEST_ID,
  deferred,
} from './quest-comment-test-fixtures'

const { createQuestCommentMock } = vi.hoisted(() => ({
  createQuestCommentMock: vi.fn(),
}))
vi.mock('../api/create-quest-comment', () => ({
  createQuestComment: createQuestCommentMock,
}))

const AUTHOR = {
  id: 'u-1',
  name: 'Ada Lovelace',
  image: null,
  avatarId: null,
  initials: 'AL',
}

function setup() {
  const seed = makeCache(
    [makeComment({ id: 'newest' }), makeComment({ id: 'middle' })],
    [makeComment({ id: 'oldest' })],
  )
  const { queryClient, wrapper, readCache } = createTestQueryClient(seed)
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useCreateQuestComment(QUEST_ID, AUTHOR), {
    wrapper,
  })

  return { result, readCache, invalidateSpy, seed }
}

afterEach(() => {
  createQuestCommentMock.mockReset()
  setCommentDraft(QUEST_ID, '')
  setCommentError(QUEST_ID, null)
  while (getUnsentComments(QUEST_ID).length > 0) {
    discardUnsentComment(QUEST_ID)
  }
})

describe('useCreateQuestComment', () => {
  it('añade el comentario pendiente al principio de la página más reciente', async () => {
    createQuestCommentMock.mockReturnValue(new Promise(() => {}))
    const { result, readCache } = setup()

    result.current.mutate('Hello guild')

    await waitFor(() =>
      expect(readCache()?.pages[0].items.map((item) => item.id)).toHaveLength(
        3,
      ),
    )
    const [optimistic] = readCache()!.pages[0].items
    expect(optimistic).toMatchObject({
      body: 'Hello guild',
      author: AUTHOR,
      pending: true,
      canEdit: false,
      canDelete: false,
    })
    // Las páginas anteriores no se tocan.
    expect(readCache()?.pages[1].items.map((item) => item.id)).toEqual([
      'oldest',
    ])
  })

  it('la fila del servidor sustituye a la optimista en su sitio', async () => {
    createQuestCommentMock.mockResolvedValue(
      makeComment({ id: 'server-id', body: 'Hello guild' }),
    )
    const { result, readCache } = setup()

    result.current.mutate('Hello guild')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const items = readCache()!.pages[0].items
    expect(items.map((item) => item.id)).toEqual([
      'server-id',
      'newest',
      'middle',
    ])
    expect(items[0].pending).toBeUndefined()
  })

  it('ante un error retira el optimista, devuelve el texto al borrador y publica el error', async () => {
    createQuestCommentMock.mockRejectedValue(new Error('Forbidden: nope'))
    const { result, readCache, seed } = setup()

    result.current.mutate('Hello guild')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(readCache()).toEqual(seed)
    expect(getCommentDraft(QUEST_ID)).toBe('Hello guild')
    expect(getCommentError(QUEST_ID)).toBe('Forbidden: nope')
  })

  it('no pisa un borrador nuevo escrito mientras la publicación estaba en vuelo', async () => {
    createQuestCommentMock.mockRejectedValue(new Error('Forbidden: nope'))
    const { result } = setup()
    setCommentDraft(QUEST_ID, 'Something else')

    result.current.mutate('Hello guild')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getCommentDraft(QUEST_ID)).toBe('Something else')
    // El texto fallido no se pierde: queda apartado en los no enviados.
    expect(getUnsentComments(QUEST_ID)).toEqual(['Hello guild'])
    expect(getCommentError(QUEST_ID)).toBe('Forbidden: nope')
  })

  it('al asentarse invalida SOLO el hilo de esta quest', async () => {
    createQuestCommentMock.mockResolvedValue(makeComment({ id: 'server-id' }))
    const { result, invalidateSpy } = setup()

    result.current.mutate('Hello guild')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['quest-comments', QUEST_ID],
    })
  })

  it('dos publicaciones solapadas: la primera falla y la segunda sale bien', async () => {
    const first = deferred()
    const second = deferred()
    createQuestCommentMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { result, readCache } = setup()

    result.current.mutate('First')
    result.current.mutate('Second')
    await waitFor(() => expect(readCache()!.pages[0].items).toHaveLength(4))

    first.reject(new Error('Conflict: first failed'))
    second.resolve(makeComment({ id: 'server-second', body: 'Second' }))

    // El fallo de la PRIMERA se ve aunque la última llamada a `mutate` fuera
    // la segunda, y su texto vuelve al borrador vacío.
    await waitFor(() =>
      expect(getCommentError(QUEST_ID)).toBe('Conflict: first failed'),
    )
    expect(getCommentDraft(QUEST_ID)).toBe('First')
    // Rollback dirigido: la segunda, ya confirmada, sigue en el hilo.
    await waitFor(() =>
      expect(readCache()!.pages[0].items.map((item) => item.id)).toEqual([
        'server-second',
        'newest',
        'middle',
      ]),
    )
  })

  it('un fallo de red publica un mensaje propio, no "Failed to fetch"', async () => {
    createQuestCommentMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = setup()
    result.current.mutate('Hello guild')
    await waitFor(() =>
      expect(getCommentError(QUEST_ID)).toBe(
        "Couldn't post your comment. Check your connection and try again.",
      ),
    )
  })
})
