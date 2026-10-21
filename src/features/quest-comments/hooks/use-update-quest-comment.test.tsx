// @vitest-environment jsdom
// Fija el comportamiento optimista de useUpdateQuestComment sobre la caché
// infinita: parchea el cuerpo y la marca "edited" en la página donde esté el
// comentario, no marca nada si el cuerpo no cambia, revierte ante un error y
// solo invalida `['quest-comments', questId]`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import { useUpdateQuestComment } from './use-update-quest-comment'
import {
  createTestQueryClient,
  makeCache,
  makeComment,
  QUEST_ID,
} from './quest-comment-test-fixtures'

const { updateQuestCommentMock } = vi.hoisted(() => ({
  updateQuestCommentMock: vi.fn(),
}))
vi.mock('../api/update-quest-comment', () => ({
  updateQuestComment: updateQuestCommentMock,
}))

function setup() {
  const seed = makeCache(
    [makeComment({ id: 'newest' })],
    [makeComment({ id: 'older', body: 'Original' })],
  )
  const { queryClient, wrapper, readCache } = createTestQueryClient(seed)
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useUpdateQuestComment(QUEST_ID), {
    wrapper,
  })
  const readOlder = () =>
    readCache()!.pages[1].items.find((item) => item.id === 'older')!

  return { result, readCache, readOlder, invalidateSpy, seed }
}

afterEach(() => {
  updateQuestCommentMock.mockReset()
})

describe('useUpdateQuestComment', () => {
  it('parchea cuerpo y editedAt de forma optimista, aunque esté en una página antigua', async () => {
    updateQuestCommentMock.mockReturnValue(new Promise(() => {}))
    const { result, readOlder } = setup()

    result.current.mutate({ commentId: 'older', body: 'Edited' })

    await waitFor(() => expect(readOlder().body).toBe('Edited'))
    expect(readOlder().editedAt).toBeInstanceOf(Date)
  })

  it('un cuerpo idéntico no marca "edited"', async () => {
    updateQuestCommentMock.mockReturnValue(new Promise(() => {}))
    const { result, readOlder } = setup()

    result.current.mutate({ commentId: 'older', body: 'Original' })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(readOlder().editedAt).toBeNull()
  })

  it('la respuesta del servidor sustituye al parche optimista', async () => {
    const serverEditedAt = new Date('2026-07-21T09:00:00.000Z')
    updateQuestCommentMock.mockResolvedValue(
      makeComment({ id: 'older', body: 'Edited', editedAt: serverEditedAt }),
    )
    const { result, readOlder } = setup()

    result.current.mutate({ commentId: 'older', body: 'Edited' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(readOlder().editedAt).toEqual(serverEditedAt)
  })

  it('revierte al snapshot si el servidor rechaza la edición', async () => {
    updateQuestCommentMock.mockRejectedValue(new Error('Conflict: nope'))
    const { result, readCache, seed } = setup()

    result.current.mutate({ commentId: 'older', body: 'Edited' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(readCache()).toEqual(seed)
  })

  it('al asentarse invalida SOLO el hilo de esta quest', async () => {
    updateQuestCommentMock.mockResolvedValue(makeComment({ id: 'older' }))
    const { result, invalidateSpy } = setup()

    result.current.mutate({ commentId: 'older', body: 'Edited' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['quest-comments', QUEST_ID],
    })
  })
})
