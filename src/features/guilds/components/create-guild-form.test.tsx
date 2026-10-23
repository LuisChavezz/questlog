// @vitest-environment jsdom
// Momento en que el formulario de creación de guild muestra errores. Caso
// propio: escribir el nombre deriva el slug con setFieldValue, que marca el
// slug como tocado; antes del primer envío eso no debe pintar errores en un
// campo que el usuario ni siquiera ha tocado.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

import { CreateGuildForm } from './create-guild-form'

const mutateAsync = vi.fn()

vi.mock('../hooks/use-create-guild', () => ({
  useCreateGuild: () => ({ mutateAsync, error: null }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CreateGuildForm — momento de la validación', () => {
  it('un nombre que deriva un slug vacío no muestra errores hasta el envío', async () => {
    render(<CreateGuildForm />)

    // Sin caracteres válidos para el slug: se deriva vacío.
    const name = screen.getByLabelText(/Name/)
    fireEvent.change(name, { target: { value: '!!!' } })
    fireEvent.blur(name)
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Create Guild' }))

    expect(await screen.findByText('Slug is required')).not.toBeNull()
    expect(mutateAsync).not.toHaveBeenCalled()

    fireEvent.change(name, { target: { value: 'Night Watch' } })
    await waitFor(() => {
      expect(screen.queryByText('Slug is required')).toBeNull()
    })
  })
})
