import { createFileRoute, redirect } from '@tanstack/react-router'

import { AppLayout } from '#/components/layouts/app-layout'
import { getServerSession } from '#/lib/server/session'

// Ruta de layout pathless: no agrega segmento a la URL.
// Todas las rutas dentro de _app/ heredan este layout con sidebar.
// beforeLoad verifica la sesión en el servidor antes de renderizar.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const session = await getServerSession()
    if (!session) {
      // Conservar el destino pedido (path + search + hash) para volver a él
      // tras iniciar sesión; el login lo valida con getSafeRedirect.
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    // La sesión queda disponible en el contexto de las rutas hijas
    return { session }
  },
  component: AppLayout,
})
