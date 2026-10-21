// @vitest-environment jsdom
// Fija el comportamiento optimista de useDeleteQuestComment sobre la caché
// infinita: retira el comentario de la página donde esté, revierte ante un
// error y solo invalida `['quest-comments', questId]`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import { useDeleteQuestComment } from './use-delete-quest-comment'
import {
  createTestQueryClient,
  makeCache,
  makeComment,
  QUEST_ID,
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
})

describe('useDeleteQuestComment', () => {
  it('retira el comentario de forma optimista sin tocar el resto de páginas', async () => {
    deleteQuestCommentMock.mockReturnValue(new Promise(() => {}))
    const { result, ids } = setup()

    result.current.mutate({ commentId: 'target' })

    await waitFor(() => expect(ids()).toEqual([['newest'], ['oldest']]))
  })

  it('revierte al snapshot si el servidor rechaza el borrado', async () => {
    deleteQuestCommentMock.mockRejectedValue(new Error('Forbidden: nope'))
    const { result, readCache, seed } = setup()

    result.current.mutate({ commentId: 'target' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(readCache()).toEqual(seed)
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
})
