// @vitest-environment jsdom
// Confirma que el diálogo de creación consolidado se comporta igual en sus dos
// modos: el personal (sin contexto de guild) y el de guild. La consolidación de
// #11 fusionó dos diálogos casi idénticos en uno parametrizado por la prop
// `guild`; este test fija que cada modo muestra exactamente los campos que le
// corresponden y con el título correcto.
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import type { MemberOption } from './member-select'
import { CreateQuestDialog } from './create-quest-dialog'

const MEMBERS: MemberOption[] = [
  { userId: 'u-1', name: 'Ada Lovelace' },
  { userId: 'u-2', name: 'Grace Hopper' },
]

function renderDialog(guild?: {
  guildId: string
  slug: string
  members: MemberOption[]
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const result = render(
    <QueryClientProvider client={queryClient}>
      <CreateQuestDialog guild={guild} />
    </QueryClientProvider>,
  )

  // Abrir el diálogo (el formulario vive en el contenido del Dialog de Radix).
  fireEvent.click(screen.getByRole('button', { name: 'New Quest' }))

  return result
}

// Radix Select consulta Pointer Capture sobre el trigger al montarse.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  cleanup()
})

// Campos comunes a ambos modos — deben estar siempre.
const SHARED_FIELDS = ['Title', 'Description', 'Priority', 'Tags', 'Due Date']

describe('CreateQuestDialog — modo personal', () => {
  it('muestra el título personal y los campos comunes, sin asignado/supervisor', () => {
    renderDialog()

    expect(screen.getByRole('heading', { name: 'Create Quest' })).not.toBeNull()

    for (const label of SHARED_FIELDS) {
      expect(screen.getByText(label)).not.toBeNull()
    }

    // Sin contexto de guild no hay selectores de asignado/supervisor.
    expect(screen.queryByText('Assignee')).toBeNull()
    expect(screen.queryByText('Supervisor')).toBeNull()
  })
})

describe('CreateQuestDialog — modo guild', () => {
  it('muestra el título de guild, los campos comunes y los selectores de miembro', () => {
    renderDialog({ guildId: 'g-1', slug: 'my-guild', members: MEMBERS })

    expect(
      screen.getByRole('heading', { name: 'Create Guild Quest' }),
    ).not.toBeNull()

    for (const label of SHARED_FIELDS) {
      expect(screen.getByText(label)).not.toBeNull()
    }

    // En contexto de guild aparecen ambos selectores.
    expect(screen.getByText('Assignee')).not.toBeNull()
    expect(screen.getByText('Supervisor')).not.toBeNull()
    // Y quedan accesibles por su aria-label (dos comboboxes de miembro).
    expect(screen.getByRole('combobox', { name: 'Assignee' })).not.toBeNull()
    expect(screen.getByRole('combobox', { name: 'Supervisor' })).not.toBeNull()
  })
})
