import { createFileRoute, redirect } from '@tanstack/react-router'

import { AppLayout } from '#/components/layouts/app-layout'
import { getServerSession } from '#/lib/server/session'

// Ruta de layout pathless: no agrega segmento a la URL.
// Todas las rutas dentro de _app/ heredan este layout con sidebar.
// beforeLoad verifica la sesión en el servidor antes de renderizar.
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    // La sesión queda disponible en el contexto de las rutas hijas
    return { session }
  },
  component: AppLayout,
})
