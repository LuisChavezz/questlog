import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLayout } from '#/components/layouts/auth-layout'
import { getSafeRedirect } from '#/features/auth/schemas/auth-schemas'
import { getServerSession } from '#/lib/server/session'

// Ruta de layout pathless: no agrega segmento a la URL.
// Todas las rutas dentro de _auth/ heredan este layout centrado sin sidebar.
// Si el usuario ya tiene sesión activa, lo redirige al `redirect` pedido (p. ej.
// un deep link abierto con la sesión iniciada en otra pestaña) o a quests.
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    const session = await getServerSession()
    if (session) {
      // Este layout no valida search params (lo hacen login/register), así que
      // el valor llega sin tipar: solo se acepta una cadena, y siempre filtrada
      // por getSafeRedirect. `href` conserva el search del deep link.
      const { redirect: target } = location.search as { redirect?: unknown }
      throw redirect({
        href: getSafeRedirect(typeof target === 'string' ? target : undefined),
      })
    }
  },
  component: AuthLayout,
})
