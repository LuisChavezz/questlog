// Función de servidor — regenera (o genera por primera vez) el escudo de
// armas de un guild. Este archivo es solo el envoltorio RPC: resuelve la
// sesión y delega la lógica en `regenerateCoatOfArmsHandler`, que vive aparte
// para poder testearse directamente (ver regenerate-coat-of-arms.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { regenerateCoatOfArmsHandler } from './regenerate-coat-of-arms.handler'
import { regenerateCoatOfArmsSchema } from '../schemas/guild-schemas'

export const regenerateCoatOfArms = createServerFn({ method: 'POST' })
  .inputValidator(regenerateCoatOfArmsSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    return regenerateCoatOfArmsHandler(data, session.user.id)
  })
