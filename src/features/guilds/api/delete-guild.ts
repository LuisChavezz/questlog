// Función de servidor — borra un guild por completo (y, por cascada, sus
// miembros, sus quests y la bitácora de actividad de esas quests).
// Este archivo es solo el envoltorio RPC: resuelve la sesión y delega la lógica
// en `deleteGuildHandler`, que vive aparte para poder testearse directamente
// (ver delete-guild.handler.ts) — ahí está documentada la cadena de cascadas y
// la reverificación de propiedad con bloqueo de fila.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { deleteGuildSchema } from '../schemas/guild-schemas'
import { deleteGuildHandler } from './delete-guild.handler'

export const deleteGuild = createServerFn({ method: 'POST' })
  .inputValidator(deleteGuildSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    return deleteGuildHandler(data, session.user.id)
  })
