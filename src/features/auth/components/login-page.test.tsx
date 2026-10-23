// @vitest-environment jsdom
// Momento en que el login muestra errores de validación: ninguno mientras el
// usuario escribe antes de enviar (escribir "lu" en el email no debe gritar
// "Invalid email address"), todos al intentar enviar, y desde ahí revalidación
// en vivo. El botón no se bloquea por validez: es el envío el que la revela.
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

import { authClient } from '#/lib/auth-client'
import { LoginPage } from './login-page'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}))
vi.mock('#/lib/auth-client', () => ({
  authClient: { signIn: { email: vi.fn() } },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const submitButton = () => screen.getByRole('button', { name: 'Sign in' })

describe('LoginPage — momento de la validación', () => {
  it('no muestra errores mientras se escribe antes del primer envío', () => {
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'lu' },
    })
    fireEvent.blur(screen.getByLabelText('Email'))

    expect(screen.queryByRole('alert')).toBeNull()
    expect(submitButton().hasAttribute('disabled')).toBe(false)
  })

  it('al enviar muestra los errores sin llamar al servidor y luego revalida en vivo', async () => {
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'lu' },
    })
    fireEvent.click(submitButton())

    expect(await screen.findByText('Invalid email address')).not.toBeNull()
    expect(screen.getByText('Password is required')).not.toBeNull()
    expect(authClient.signIn.email).not.toHaveBeenCalled()

    // Tras el intento, corregir un campo retira su error en el acto.
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'lu@questlog.dev' },
    })
    await waitFor(() => {
      expect(screen.queryByText('Invalid email address')).toBeNull()
    })
    expect(screen.getByText('Password is required')).not.toBeNull()
  })
})
