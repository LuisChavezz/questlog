// @vitest-environment jsdom
// Fija el comportamiento optimista de useCreateQuestComment sobre la caché
// infinita del hilo: el comentario entra al principio de la página 0 (la más
// reciente) marcado como pendiente, la fila del servidor lo sustituye al volver,
// un error restaura el snapshot y devuelve el texto al borrador, y al asentarse
// solo se invalida `['quest-comments', questId]`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import { getCommentDraft, setCommentDraft } from '../comment-drafts'
import { useCreateQuestComment } from './use-create-quest-comment'
import {
  createTestQueryClient,
  makeCache,
  makeComment,
  QUEST_ID,
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

  it('ante un error restaura el snapshot y devuelve el texto al borrador', async () => {
    createQuestCommentMock.mockRejectedValue(new Error('Forbidden: nope'))
    const { result, readCache, seed } = setup()

    result.current.mutate('Hello guild')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(readCache()).toEqual(seed)
    expect(getCommentDraft(QUEST_ID)).toBe('Hello guild')
  })

  it('no pisa un borrador nuevo escrito mientras la publicación estaba en vuelo', async () => {
    createQuestCommentMock.mockRejectedValue(new Error('Forbidden: nope'))
    const { result } = setup()
    setCommentDraft(QUEST_ID, 'Something else')

    result.current.mutate('Hello guild')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getCommentDraft(QUEST_ID)).toBe('Something else')
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
})
