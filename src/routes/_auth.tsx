import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLayout } from '#/components/layouts/auth-layout'
import { getServerSession } from '#/lib/server/session'

// Ruta de layout pathless: no agrega segmento a la URL.
// Todas las rutas dentro de _auth/ heredan este layout centrado sin sidebar.
// Si el usuario ya tiene sesión activa, lo redirige a quests.
export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: '/quests' })
    }
  },
  component: AuthLayout,
})
