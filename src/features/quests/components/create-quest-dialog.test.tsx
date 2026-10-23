// @vitest-environment jsdom
// Confirma que el diálogo de creación consolidado se comporta igual en sus dos
// modos: el personal (sin contexto de guild) y el de guild. La consolidación de
// #11 fusionó dos diálogos casi idénticos en uno parametrizado por la prop
// `guild`; este test fija que cada modo muestra exactamente los campos que le
// corresponden y con el título correcto.
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

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

// Timeout de 15 s por describe, como los demás tests pesados de quests: monta
// el diálogo real (Radix Dialog + Select) bajo jsdom y, con la suite entera en
// paralelo, puede superar los 5 s por defecto. Es tiempo de pared, no lógica
// colgada.
const SLOW = { timeout: 15_000 }

describe('CreateQuestDialog — momento de la validación', SLOW, () => {
  it('no marca el título vacío hasta el envío y luego revalida en vivo', async () => {
    renderDialog()

    // Escribir y borrar el título antes de enviar no muestra error.
    const title = screen.getByLabelText(/Title/)
    fireEvent.change(title, { target: { value: 'Draft' } })
    fireEvent.change(title, { target: { value: '' } })
    fireEvent.blur(title)
    expect(screen.queryByText('Title is required')).toBeNull()

    const submit = screen.getByRole('button', { name: 'Create Quest' })
    expect(submit.hasAttribute('disabled')).toBe(false)
    fireEvent.click(submit)

    expect(await screen.findByText('Title is required')).not.toBeNull()

    fireEvent.change(title, { target: { value: 'Slay the dragon' } })
    await waitFor(() => {
      expect(screen.queryByText('Title is required')).toBeNull()
    })
  })
})

// Formas de cerrar el diálogo sin crear. El clic fuera no se simula aquí (Radix
// lo detecta con pointer events que jsdom no reproduce fielmente); comparte
// con estas la misma ruta `onOpenChange(false)`.
const CLOSE_PATHS = [
  [
    'Cancel',
    () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })),
  ],
  [
    'la X',
    () => fireEvent.click(screen.getByRole('button', { name: 'Close' })),
  ],
  [
    'Escape',
    () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }),
  ],
] as const

describe('CreateQuestDialog — reapertura limpia', SLOW, () => {
  it.each(CLOSE_PATHS)(
    'cerrar con %s descarta lo tecleado, los errores y el estado de envío',
    async (_path, close) => {
      renderDialog()

      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: 'Draft notes' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Create Quest' }))
      expect(await screen.findByText('Title is required')).not.toBeNull()

      close()
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
      fireEvent.click(screen.getByRole('button', { name: 'New Quest' }))

      expect(screen.queryByText('Title is required')).toBeNull()
      expect(
        screen.getByLabelText<HTMLTextAreaElement>('Description').value,
      ).toBe('')

      // Sin envío previo: escribir y borrar el título no muestra el error.
      const title = screen.getByLabelText(/Title/)
      fireEvent.change(title, { target: { value: 'Draft' } })
      fireEvent.change(title, { target: { value: '' } })
      expect(screen.queryByText('Title is required')).toBeNull()
    },
  )
})
