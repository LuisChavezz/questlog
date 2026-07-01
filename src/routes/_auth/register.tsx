import { createFileRoute } from '@tanstack/react-router'

import { RegisterPage } from '#/features/auth/components/register-page'
import { authSearchSchema } from '#/features/auth/schemas/auth-schemas'

export const Route = createFileRoute('/_auth/register')({
  // `redirect` permite volver al origen (p. ej. una invitación) tras registrarse
  validateSearch: authSearchSchema,
  component: RegisterPage,
})
