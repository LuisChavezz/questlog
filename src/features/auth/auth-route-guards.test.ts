// @vitest-environment node
// Tests de los guards de sesión de los layouts pathless `_app` y `_auth`: se
// invoca su `beforeLoad` directamente con `getServerSession` mockeado (es un
// server fn, que bajo Vitest no tiene el transform de TanStack Start) y se
// inspecciona el redirect lanzado. Vive fuera de src/routes a propósito: el
// plugin del router trataría cualquier archivo de ese directorio como ruta.
import { isRedirect } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getServerSession } from '#/lib/server/session'
import { Route as AppRoute } from '#/routes/_app'
import { Route as AuthRoute } from '#/routes/_auth'

vi.mock('#/lib/server/session', () => ({ getServerSession: vi.fn() }))
// Los layouts no participan en el guard; se sustituyen para no cargar la UI.
vi.mock('#/components/layouts/app-layout', () => ({ AppLayout: () => null }))
vi.mock('#/components/layouts/auth-layout', () => ({ AuthLayout: () => null }))

const SESSION = { user: { id: 'u-1' } }

// Ubicación mínima que leen los guards: href (path + search + hash) y el search
// ya parseado por el router.
function location(href: string, search: Record<string, unknown> = {}) {
  return { href, search }
}

// Ejecuta un `beforeLoad` y devuelve las opciones del redirect que lance (o
// `undefined` si deja pasar). El tipo real del argumento es el contexto
// completo del router; los guards solo usan `location`.
async function runGuard(
  beforeLoad: unknown,
  loc: ReturnType<typeof location>,
): Promise<{ to?: string; href?: string; search?: unknown } | undefined> {
  try {
    await (beforeLoad as (ctx: { location: typeof loc }) => unknown)({
      location: loc,
    })
    return undefined
  } catch (error) {
    if (!isRedirect(error)) throw error
    return error.options as { to?: string; href?: string; search?: unknown }
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('guard de _app (rutas autenticadas)', () => {
  it('sin sesión manda a /login conservando path + search en redirect', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const target = await runGuard(
      AppRoute.options.beforeLoad,
      location('/guilds/my-guild/members?from=deeplink'),
    )

    expect(target).toMatchObject({
      to: '/login',
      search: { redirect: '/guilds/my-guild/members?from=deeplink' },
    })
  })

  it('con sesión deja pasar', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never)

    await expect(
      runGuard(AppRoute.options.beforeLoad, location('/quests')),
    ).resolves.toBeUndefined()
  })
})

describe('guard de _auth (login / registro)', () => {
  it('sin sesión deja pasar', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    await expect(
      runGuard(
        AuthRoute.options.beforeLoad,
        location('/login?redirect=%2Fquests', { redirect: '/quests' }),
      ),
    ).resolves.toBeUndefined()
  })

  it('con sesión respeta un redirect interno, search incluido', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never)

    const target = await runGuard(
      AuthRoute.options.beforeLoad,
      location('/login', {
        redirect: '/guilds/my-guild/members?from=deeplink',
      }),
    )

    expect(target?.href).toBe('/guilds/my-guild/members?from=deeplink')
  })

  it('con sesión y sin redirect va a /quests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never)

    const target = await runGuard(
      AuthRoute.options.beforeLoad,
      location('/login'),
    )

    expect(target?.href).toBe('/quests')
  })

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com'])(
    'con sesión descarta el redirect externo %s',
    async (redirect) => {
      vi.mocked(getServerSession).mockResolvedValue(SESSION as never)

      const target = await runGuard(
        AuthRoute.options.beforeLoad,
        location('/login', { redirect }),
      )

      expect(target?.href).toBe('/quests')
    },
  )

  it('con sesión ignora un redirect que no es cadena', async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as never)

    const target = await runGuard(
      AuthRoute.options.beforeLoad,
      location('/login', { redirect: 42 }),
    )

    expect(target?.href).toBe('/quests')
  })
})
