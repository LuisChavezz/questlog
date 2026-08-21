// Función de servidor — edita el perfil de un guild (nombre y descripción).
// Este archivo es solo el envoltorio RPC: resuelve la sesión y delega la lógica
// en `updateGuildHandler`, que vive aparte para poder testearse directamente
// (ver update-guild.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { updateGuildHandler } from './update-guild.handler'
import { updateGuildSchema } from '../schemas/guild-schemas'

export const updateGuild = createServerFn({ method: 'POST' })
  .inputValidator(updateGuildSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    return updateGuildHandler(data, session.user.id)
  })
