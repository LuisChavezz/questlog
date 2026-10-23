// @vitest-environment jsdom
// Momento en que el nombre visible del usuario muestra errores: vaciarlo no lo
// marca hasta que se intenta guardar, y el botón no se bloquea por validez.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

import { SettingsGeneralSection } from './settings-general-section'

const mutateAsync = vi.fn()

vi.mock('../hooks/use-update-user', () => ({
  useUpdateUser: () => ({ mutateAsync, error: null }),
}))
// El selector de avatar no interviene en la validación del nombre.
vi.mock('./avatar-picker', () => ({ AvatarPicker: () => null }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsGeneralSection — momento de la validación', () => {
  it('un nombre vacío solo se marca al guardar y se retira al corregirlo', async () => {
    render(
      <SettingsGeneralSection
        currentName="Lu"
        currentEmail="lu@questlog.dev"
        currentImage={null}
        currentAvatarId={null}
      />,
    )

    const name = screen.getByLabelText(/Name/)
    fireEvent.change(name, { target: { value: '' } })
    fireEvent.blur(name)
    expect(screen.queryByText('Name is required')).toBeNull()

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save.hasAttribute('disabled')).toBe(false)
    fireEvent.click(save)

    expect(await screen.findByText('Name is required')).not.toBeNull()
    expect(mutateAsync).not.toHaveBeenCalled()

    fireEvent.change(name, { target: { value: 'Luis' } })
    await waitFor(() => {
      expect(screen.queryByText('Name is required')).toBeNull()
    })
  })

  it('tras guardar conserva lo guardado y vuelve a la validación diferida', async () => {
    mutateAsync.mockResolvedValue(undefined)
    render(
      <SettingsGeneralSection
        currentName="Lu"
        currentEmail="lu@questlog.dev"
        currentImage={null}
        currentAvatarId={null}
      />,
    )

    const name = screen.getByLabelText<HTMLInputElement>(/Name/)
    fireEvent.change(name, { target: { value: 'Luis' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ name: 'Luis' })
    })

    // La sesión aún no se ha refrescado (las props siguen con el nombre
    // viejo): el input no debe volver a "Lu".
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
      ).toBe(false)
    })
    expect(name.value).toBe('Luis')

    fireEvent.change(name, { target: { value: '' } })
    expect(screen.queryByText('Name is required')).toBeNull()
  })
})
