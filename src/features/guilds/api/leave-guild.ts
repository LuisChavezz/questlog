// Función de servidor — permite a un miembro abandonar un guild voluntariamente.
// El owner no puede abandonar directamente: debe transferir la propiedad antes
// de volverse elegible como miembro normal.
// Este archivo es solo el envoltorio RPC: resuelve la sesión y delega la lógica
// en `leaveGuildHandler`, que vive aparte para poder testearse directamente
// (ver leave-guild.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { leaveGuildSchema } from '../schemas/guild-schemas'
import { leaveGuildHandler } from './leave-guild.handler'

export const leaveGuild = createServerFn({ method: 'POST' })
  .inputValidator(leaveGuildSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    return leaveGuildHandler(data, session.user.id)
  })
