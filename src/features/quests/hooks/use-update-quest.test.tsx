// @vitest-environment jsdom
// Fija el comportamiento optimista de useUpdateQuest para asignado/supervisor.
// La consolidación de #12 eliminó el hook aparte
// (use-update-guild-quest-assignment) y enrutó la reasignación por useUpdateQuest;
// para que eso no pierda la actualización optimista, el onMutate ahora parchea
// también assigneeId/supervisorId. Estos tests verifican parcheo, limpieza (null)
// y rollback ante error — el contrato que antes cubría el hook borrado.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import type { Quest } from '#/db/schema'
import { useUpdateQuest } from './use-update-quest'

// El server fn se sustituye para controlar resolución/rechazo sin red. `vi.mock`
// y `vi.hoisted` los eleva Vitest por encima de los imports, así que la
// sustitución ya está activa cuando se carga el módulo del hook.
const { updateQuestMock } = vi.hoisted(() => ({ updateQuestMock: vi.fn() }))
vi.mock('../api/update-quest', () => ({ updateQuest: updateQuestMock }))

const QUERY_KEY = ['guild', 'my-guild', 'quests'] as const

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'quest-1',
    ownerId: 'owner',
    assigneeId: null,
    supervisorId: null,
    guildId: 'guild-1',
    title: 'Slay the dragon',
    description: null,
    status: 'backlog',
    priority: 'medium',
    tags: [],
    dueDate: null,
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

// Monta el hook con una caché sembrada con `seed` bajo QUERY_KEY.
function setup(seed: Quest[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  queryClient.setQueryData<Quest[]>(QUERY_KEY, seed)

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const { result } = renderHook(() => useUpdateQuest(QUERY_KEY), { wrapper })
  const readQuest = () =>
    queryClient
      .getQueryData<Quest[]>(QUERY_KEY)!
      .find((q) => q.id === 'quest-1')!

  return { result, readQuest }
}

afterEach(() => {
  updateQuestMock.mockReset()
})

describe('useUpdateQuest — actualización optimista de asignación', () => {
  it('parchea assigneeId de forma optimista antes de la respuesta del servidor', async () => {
    // La promesa nunca resuelve: aísla el efecto del onMutate.
    updateQuestMock.mockReturnValue(new Promise(() => {}))
    const { result, readQuest } = setup([makeQuest({ assigneeId: null })])

    result.current.mutate({ id: 'quest-1', assigneeId: 'u-2' })

    await waitFor(() => expect(readQuest().assigneeId).toBe('u-2'))
  })

  it('limpia assigneeId con null de forma optimista', async () => {
    updateQuestMock.mockReturnValue(new Promise(() => {}))
    const { result, readQuest } = setup([makeQuest({ assigneeId: 'u-2' })])

    result.current.mutate({ id: 'quest-1', assigneeId: null })

    await waitFor(() => expect(readQuest().assigneeId).toBeNull())
  })

  it('parchea supervisorId de forma optimista', async () => {
    updateQuestMock.mockReturnValue(new Promise(() => {}))
    const { result, readQuest } = setup([makeQuest({ supervisorId: null })])

    result.current.mutate({ id: 'quest-1', supervisorId: 'u-3' })

    await waitFor(() => expect(readQuest().supervisorId).toBe('u-3'))
  })

  it('revierte la asignación si el servidor falla (rollback)', async () => {
    updateQuestMock.mockRejectedValue(new Error('boom'))
    const { result, readQuest } = setup([makeQuest({ assigneeId: 'u-1' })])

    result.current.mutate({ id: 'quest-1', assigneeId: 'u-2' })

    // Tras el error, el onError restaura el snapshot previo.
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(readQuest().assigneeId).toBe('u-1')
  })
})
