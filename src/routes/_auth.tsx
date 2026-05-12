import { createFileRoute } from '@tanstack/react-router'

import { AuthLayout } from '#/components/layouts/auth-layout'

// Ruta de layout pathless: no agrega segmento a la URL.
// Todas las rutas dentro de _auth/ heredan este layout centrado sin sidebar.
export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})
