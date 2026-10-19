// @vitest-environment jsdom
// Tests de la navegación post-autenticación de los hooks de login y registro:
// tras un alta o inicio de sesión correcto deben navegar con `href` (no `to`)
// al `redirect` filtrado por getSafeRedirect, para que el search de un deep link
// llegue intacto. El router y el cliente de Better Auth se mockean: aquí solo
// interesa qué destino se pide al navegar.
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { authClient } from '#/lib/auth-client'
import { useLoginForm } from './use-login-form'
import { useRegisterForm } from './use-register-form'

const navigate = vi.fn()
const search: { redirect?: string } = {}

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => search,
}))
vi.mock('#/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  },
}))

const DEEP_LINK = '/guilds/my-guild/members?from=deeplink'

async function submitLogin() {
  const { result } = renderHook(() => useLoginForm())
  await act(async () => {
    result.current.form.setFieldValue('email', 'test@questlog.dev')
    result.current.form.setFieldValue('password', 'Test1234!')
    await result.current.form.handleSubmit()
  })
}

async function submitRegister() {
  const { result } = renderHook(() => useRegisterForm())
  await act(async () => {
    result.current.form.setFieldValue('name', 'Test User')
    result.current.form.setFieldValue('email', 'test@questlog.dev')
    result.current.form.setFieldValue('password', 'Test1234!')
    result.current.form.setFieldValue('confirmPassword', 'Test1234!')
    await result.current.form.handleSubmit()
  })
}

afterEach(() => {
  delete search.redirect
  vi.clearAllMocks()
})

describe.each([
  ['useLoginForm', submitLogin, () => vi.mocked(authClient.signIn.email)],
  ['useRegisterForm', submitRegister, () => vi.mocked(authClient.signUp.email)],
] as const)('%s — navegación tras autenticarse', (_name, submit, authCall) => {
  it('navega con href al deep link, conservando path + search', async () => {
    authCall().mockResolvedValue({ error: null })
    search.redirect = DEEP_LINK

    await submit()

    expect(navigate).toHaveBeenCalledWith({ href: DEEP_LINK })
  })

  it('sin redirect navega a /quests', async () => {
    authCall().mockResolvedValue({ error: null })

    await submit()

    expect(navigate).toHaveBeenCalledWith({ href: '/quests' })
  })

  it('descarta un redirect externo', async () => {
    authCall().mockResolvedValue({ error: null })
    search.redirect = '//evil.com'

    await submit()

    expect(navigate).toHaveBeenCalledWith({ href: '/quests' })
  })

  it('no navega si la autenticación falla', async () => {
    authCall().mockResolvedValue({ error: { message: 'Nope' } })
    search.redirect = DEEP_LINK

    await submit()

    expect(navigate).not.toHaveBeenCalled()
  })
})
