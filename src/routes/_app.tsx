import { createFileRoute } from '@tanstack/react-router'

import { AppLayout } from '#/components/layouts/app-layout'

// Ruta de layout pathless: no agrega segmento a la URL.
// Todas las rutas dentro de _app/ heredan este layout con sidebar.
export const Route = createFileRoute('/_app')({
  component: AppLayout,
})
