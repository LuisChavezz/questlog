// @vitest-environment jsdom
// Gating por rol de la página de Settings del guild: el Guild Master (dueño
// estructural) ve General, Invitations y "Delete Guild"; cualquier otro
// miembro — incluido un Officer — solo ve "Leave Guild". El servidor sigue
// siendo la autoridad final; esto fija el contrato de la UI.
import type { ReactNode } from 'react'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { GuildSettingsPage } from './guild-settings-page'

const OWNER_ID = 'user-owner'
const OFFICER_ID = 'user-officer'

let currentUserId = OWNER_ID

// Hooks de ruta alimentados desde el test; sin router montado, Link se reduce
// a un anchor
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ slug: 'test-guild' }),
  useRouteContext: () => ({ session: { user: { id: currentUserId } } }),
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

vi.mock('../api/guild-query-options', () => ({
  guildQueryOptions: (slug: string) => ({
    queryKey: ['guild', slug],
    queryFn: vi.fn(),
    staleTime: Infinity,
  }),
}))

vi.mock('../api/regenerate-invite-code', () => ({
  regenerateInviteCode: vi.fn(),
}))

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  error: null,
}
vi.mock('../hooks/use-leave-guild', () => ({
  useLeaveGuild: () => idleMutation,
}))
vi.mock('../hooks/use-delete-guild', () => ({
  useDeleteGuild: () => idleMutation,
}))
vi.mock('../hooks/use-regenerate-coat-of-arms', () => ({
  useRegenerateCoatOfArms: () => idleMutation,
}))
vi.mock('./guild-profile-form', () => ({
  GuildProfileForm: () => <form aria-label="Guild profile" />,
}))

function renderSettings(userId: string, role: 'owner' | 'admin') {
  currentUserId = userId
  const queryClient = new QueryClient()
  queryClient.setQueryData(['guild', 'test-guild'], {
    guild: {
      id: 'guild-1',
      name: 'Test Guild',
      description: null,
      ownerId: OWNER_ID,
      inviteCode: 'ABC123',
      coatOfArmsSvg: null,
    },
    currentUserRole: role,
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <GuildSettingsPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
})

describe('GuildSettingsPage — gating por rol', () => {
  it('el Guild Master ve General, Invitations, Delete y el camino para transferir', () => {
    renderSettings(OWNER_ID, 'owner')

    expect(screen.getByRole('heading', { name: 'General' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Invitations' })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Delete Guild/ })).not.toBeNull()
    expect(screen.getByText('Transfer Ownership')).not.toBeNull()
    // El owner no puede salir sin transferir: no hay botón de salida
    expect(screen.queryByRole('button', { name: /Leave Guild/ })).toBeNull()
  })

  it('un Officer solo ve Leave Guild: ni perfil, ni invitaciones, ni Delete', () => {
    renderSettings(OFFICER_ID, 'admin')

    expect(screen.getByRole('button', { name: /Leave Guild/ })).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'General' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Invitations' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Delete Guild/ })).toBeNull()
    expect(screen.queryByText('Transfer Ownership')).toBeNull()
  })
})
