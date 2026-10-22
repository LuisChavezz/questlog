// @vitest-environment jsdom
// Fija el comportamiento optimista de useDeleteQuestComment sobre la caché
// infinita: retira el comentario de la página donde esté, ante un error lo
// devuelve a SU sitio y publica el error de la quest —también con dos borrados
// solapados—, y solo invalida `['quest-comments', questId]`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import { getCommentError, setCommentError } from '../comment-drafts'
import { useDeleteQuestComment } from './use-delete-quest-comment'
import {
  createTestQueryClient,
  makeCache,
  makeComment,
  QUEST_ID,
  deferred,
} from './quest-comment-test-fixtures'

const { deleteQuestCommentMock } = vi.hoisted(() => ({
  deleteQuestCommentMock: vi.fn(),
}))
vi.mock('../api/delete-quest-comment', () => ({
  deleteQuestComment: deleteQuestCommentMock,
}))

function setup() {
  const seed = makeCache(
    [makeComment({ id: 'newest' }), makeComment({ id: 'target' })],
    [makeComment({ id: 'oldest' })],
  )
  const { queryClient, wrapper, readCache } = createTestQueryClient(seed)
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useDeleteQuestComment(QUEST_ID), {
    wrapper,
  })
  const ids = () =>
    readCache()!.pages.map((page) => page.items.map((item) => item.id))

  return { result, readCache, ids, invalidateSpy, seed }
}

afterEach(() => {
  deleteQuestCommentMock.mockReset()
  setCommentError(QUEST_ID, null)
})

describe('useDeleteQuestComment', () => {
  it('retira el comentario de forma optimista sin tocar el resto de páginas', async () => {
    deleteQuestCommentMock.mockReturnValue(new Promise(() => {}))
    const { result, ids } = setup()

    result.current.mutate({ commentId: 'target' })

    await waitFor(() => expect(ids()).toEqual([['newest'], ['oldest']]))
  })

  it('devuelve el comentario a su sitio y publica el error si el servidor rechaza el borrado', async () => {
    deleteQuestCommentMock.mockRejectedValue(new Error('Forbidden: nope'))
    const { result, readCache, seed } = setup()

    result.current.mutate({ commentId: 'target' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(readCache()).toEqual(seed)
    expect(getCommentError(QUEST_ID)).toBe('Forbidden: nope')
  })

  it('al asentarse invalida SOLO el hilo de esta quest', async () => {
    deleteQuestCommentMock.mockResolvedValue({
      id: 'target',
      questId: QUEST_ID,
    })
    const { result, invalidateSpy } = setup()

    result.current.mutate({ commentId: 'target' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['quest-comments', QUEST_ID],
    })
  })

  it('dos borrados solapados: el primero falla y el segundo sale bien', async () => {
    const first = deferred()
    const second = deferred()
    deleteQuestCommentMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { result, ids } = setup()

    result.current.mutate({ commentId: 'target' })
    result.current.mutate({ commentId: 'newest' })
    await waitFor(() => expect(ids()).toEqual([[], ['oldest']]))

    first.reject(new Error('Conflict: first failed'))
    second.resolve({ id: 'newest', questId: QUEST_ID })

    await waitFor(() =>
      expect(getCommentError(QUEST_ID)).toBe('Conflict: first failed'),
    )
    // Vuelve solo el borrado fallido; el exitoso NO resucita.
    expect(ids()).toEqual([['target'], ['oldest']])
  })

  it('un fallo de red publica un mensaje propio, no "Failed to fetch"', async () => {
    deleteQuestCommentMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = setup()
    result.current.mutate({ commentId: 'target' })
    await waitFor(() =>
      expect(getCommentError(QUEST_ID)).toBe(
        "Couldn't delete the comment. Check your connection and try again.",
      ),
    )
  })
})
