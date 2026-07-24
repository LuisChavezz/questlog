// @vitest-environment jsdom
// Verifica que editar una quest desde el drawer del Overview invalida tanto el
// detalle/actividad del guild (`['guild', slug]`) como la lista personal de
// quests (`['quests']`) — antes solo invalidaba la primera, dejando `/quests`
// rancio tras una edición hecha desde el Overview. Se aíslan los colaboradores
// pesados del hook (useUpdateQuest, contexto de columnas, drawer, query options)
// para poder invocar directamente el `updateQuest` que arma y afirmar sobre las
// invalidaciones de su onSuccess.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { useGuildActivityDrawer } from './use-guild-activity-drawer'

// Captura el `updateQuest` que el hook pasa al contexto de columnas, para
// dispararlo a mano; y un espía del `mutate` para no tocar red.
const { capturedUpdateQuest, mutateMock } = vi.hoisted(() => ({
  capturedUpdateQuest: {
    current: null as ((data: unknown) => void) | null,
  },
  mutateMock: vi.fn(),
}))

// useUpdateQuest → un `mutate` que ejecuta el onSuccess de inmediato (éxito).
vi.mock('#/features/quests/hooks/use-update-quest', () => ({
  useUpdateQuest: () => ({
    mutate: (data: unknown, opts?: { onSuccess?: () => void }) => {
      mutateMock(data)
      opts?.onSuccess?.()
    },
  }),
}))

// useQuestsColumnsGuildContext → captura el updateQuest (segundo argumento) y
// devuelve un contexto irrelevante para este test.
vi.mock('#/features/quests/hooks/use-quests-columns-guild-context', () => ({
  useQuestsColumnsGuildContext: (
    _ctx: unknown,
    updateQuest: (data: unknown) => void,
  ) => {
    capturedUpdateQuest.current = updateQuest
    return undefined
  },
}))

// El drawer real arrastra Radix/estado; aquí solo importa el cableado de caché.
vi.mock('#/features/quests/components/quest-details-drawer', () => ({
  QuestDetailsDrawer: () => null,
}))

// guildQuestsQueryOptions → opciones benignas, sin red.
vi.mock('../api/guild-query-options', () => ({
  guildQuestsQueryOptions: (slug: string) => ({
    queryKey: ['guild', slug, 'quests'],
    queryFn: async () => [],
  }),
}))

const SLUG = 'my-guild'

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  renderHook(() => useGuildActivityDrawer(SLUG, 'u-1', undefined), { wrapper })

  return { invalidateSpy }
}

afterEach(() => {
  vi.clearAllMocks()
  capturedUpdateQuest.current = null
})

describe('useGuildActivityDrawer — invalidación tras editar desde el Overview', () => {
  it('invalida el detalle del guild y la lista personal de quests', () => {
    const { invalidateSpy } = setup()

    // Editar una quest desde el drawer del Overview.
    capturedUpdateQuest.current?.({ id: 'quest-1', status: 'done' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['guild', SLUG] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['quests'] })
  })
})
