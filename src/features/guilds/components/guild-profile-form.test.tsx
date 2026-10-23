// @vitest-environment jsdom
// Momento en que el perfil del guild muestra errores: vaciar el nombre no lo
// marca hasta que se intenta guardar. El botón sigue dependiendo de que haya
// cambios respecto del guild, pero ya no de la validez.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

import { GuildProfileForm } from './guild-profile-form'

const mutateAsync = vi.fn()

vi.mock('../hooks/use-update-guild', () => ({
  useUpdateGuild: () => ({
    mutateAsync,
    reset: vi.fn(),
    error: null,
    isSuccess: false,
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('GuildProfileForm — momento de la validación', () => {
  it('un nombre vacío solo se marca al guardar y se retira al corregirlo', async () => {
    render(
      <GuildProfileForm
        slug="night-watch"
        name="Night Watch"
        description={null}
      />,
    )

    const name = screen.getByLabelText(/Name/)
    fireEvent.change(name, { target: { value: '' } })
    fireEvent.blur(name)
    expect(screen.queryByText('Name is required')).toBeNull()

    const save = screen.getByRole('button', { name: 'Save Changes' })
    expect(save.hasAttribute('disabled')).toBe(false)
    fireEvent.click(save)

    expect(await screen.findByText('Name is required')).not.toBeNull()
    expect(mutateAsync).not.toHaveBeenCalled()

    fireEvent.change(name, { target: { value: 'Night Guard' } })
    await waitFor(() => {
      expect(screen.queryByText('Name is required')).toBeNull()
    })
  })

  it('tras guardar vuelve a la validación diferida y sigue las props del refetch', async () => {
    mutateAsync.mockResolvedValue(undefined)
    const { rerender } = render(
      <GuildProfileForm
        slug="night-watch"
        name="Night Watch"
        description={null}
      />,
    )

    const name = screen.getByLabelText<HTMLInputElement>(/Name/)
    fireEvent.change(name, { target: { value: 'Night Guard' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'Night Guard',
        description: '',
      })
    })

    // El refetch del guild trae lo guardado: sin cambios pendientes.
    rerender(
      <GuildProfileForm
        slug="night-watch"
        name="Night Guard"
        description={null}
      />,
    )
    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'Save Changes' })
          .hasAttribute('disabled'),
      ).toBe(true)
    })
    expect(name.value).toBe('Night Guard')

    // El envío exitoso no deja el formulario validando en cada tecla.
    fireEvent.change(name, { target: { value: '' } })
    expect(screen.queryByText('Name is required')).toBeNull()
  })
})
