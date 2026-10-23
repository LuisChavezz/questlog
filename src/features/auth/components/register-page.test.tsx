// @vitest-environment jsdom
// Momento en que el registro muestra errores de validación, con foco en la
// confirmación de contraseña: depende de otro campo (`onChangeListenTo`), así
// que además de esperar al primer envío debe revalidarse cuando cambia
// `password`, no solo cuando cambia ella misma.
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
import { registerPasswordSchema } from '../schemas/auth-schemas'
import { RegisterPage } from './register-page'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}))
vi.mock('#/lib/auth-client', () => ({
  authClient: { signUp: { email: vi.fn() } },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('RegisterPage — momento de la validación', () => {
  it('no muestra errores antes del primer envío aunque los valores sean inválidos', () => {
    render(<RegisterPage />)

    fill('Full name', 'L')
    fill('Email', 'lu')
    fill('Password', 'short')
    fill('Confirm password', 'other')

    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Create account' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  it('tras el envío, cambiar la contraseña revalida la confirmación', async () => {
    render(<RegisterPage />)

    fill('Full name', 'Lu Chavez')
    fill('Email', 'lu@questlog.dev')
    fill('Password', 'Test1234!')
    fill('Confirm password', 'Test1234?')
    // La discrepancia ya existe, pero antes del primer envío no se anuncia.
    expect(screen.queryByText("Passwords don't match")).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText("Passwords don't match")).not.toBeNull()
    expect(authClient.signUp.email).not.toHaveBeenCalled()

    // Se corrige el otro campo, no la confirmación: el error debe irse igual.
    fill('Password', 'Test1234?')
    await waitFor(() => {
      expect(screen.queryByText("Passwords don't match")).toBeNull()
    })
  })

  it('reenviar con errores pendientes vuelve a validar sin llamar al servidor', async () => {
    render(<RegisterPage />)

    fill('Full name', 'Lu Chavez')
    fill('Email', 'lu@questlog.dev')
    fill('Password', 'short')
    fill('Confirm password', 'Test1234?')
    const submit = screen.getByRole('button', { name: 'Create account' })
    fireEvent.click(submit)

    expect(
      await screen.findByText('Password must be at least 8 characters'),
    ).not.toBeNull()
    expect(screen.getByText("Passwords don't match")).not.toBeNull()

    // Se corrige solo la contraseña: la confirmación sigue sin coincidir.
    fill('Password', 'Test1234!')
    await waitFor(() => {
      expect(
        screen.queryByText('Password must be at least 8 characters'),
      ).toBeNull()
    })

    // El segundo envío no se ignora: vuelve a pasar por los validadores (sin
    // `canSubmitWhenInvalid`, handleSubmit saldría antes de validar), sigue
    // mostrando el error vigente y no llega al servidor.
    const passwordValidation = vi.spyOn(registerPasswordSchema, 'safeParse')
    expect(submit.hasAttribute('disabled')).toBe(false)
    fireEvent.click(submit)
    await waitFor(() => {
      expect(passwordValidation).toHaveBeenCalled()
    })
    expect(screen.getByText("Passwords don't match")).not.toBeNull()
    expect(authClient.signUp.email).not.toHaveBeenCalled()
  })
})
