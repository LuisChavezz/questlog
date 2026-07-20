// Función de servidor — transfiere la propiedad de un guild a otro miembro.
// Este archivo es solo el envoltorio RPC: resuelve la sesión y delega la lógica
// en `transferGuildOwnershipHandler`, que vive aparte para poder testearse
// directamente (ver transfer-guild-ownership.handler.ts) — ahí está documentado
// el invariante que preserva y la reverificación con bloqueo de fila.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { transferGuildOwnershipSchema } from '../schemas/guild-schemas'
import { transferGuildOwnershipHandler } from './transfer-guild-ownership.handler'

export const transferGuildOwnership = createServerFn({ method: 'POST' })
  .inputValidator(transferGuildOwnershipSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    return transferGuildOwnershipHandler(data, session.user.id)
  })
