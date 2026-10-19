// Función de servidor — regenera el invite_code de un guild. Este archivo es
// solo el envoltorio RPC: resuelve la sesión y delega la lógica en
// `regenerateInviteCodeHandler`, que vive aparte para poder testearse
// directamente (ver regenerate-invite-code.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { regenerateInviteCodeSchema } from '../schemas/guild-schemas'
import { regenerateInviteCodeHandler } from './regenerate-invite-code.handler'

export const regenerateInviteCode = createServerFn({ method: 'POST' })
  .inputValidator(regenerateInviteCodeSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    return regenerateInviteCodeHandler(data, session.user.id)
  })
