import { createFileRoute } from '@tanstack/react-router'

import { LoginPage } from '#/features/auth/components/login-page'
import { authSearchSchema } from '#/features/auth/schemas/auth-schemas'

export const Route = createFileRoute('/_auth/login')({
  // `redirect` permite volver al origen (p. ej. una invitación) tras iniciar sesión
  validateSearch: authSearchSchema,
  component: LoginPage,
})
