import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'

/**
 * Server function que recupera la sesión activa desde las cookies de la request.
 * Se ejecuta siempre en el servidor (incluso cuando se llama desde el cliente)
 * gracias a createServerFn — patrón estándar de TanStack Start para SSR.
 */
export const getServerSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    return session
  },
)
