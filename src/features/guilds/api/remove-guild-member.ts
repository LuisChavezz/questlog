// Función de servidor — expulsa a un miembro del guild.
// El owner puede expulsar a cualquiera (salvo a sí mismo); un admin
// solo a miembros de rango estrictamente inferior.
// Este archivo es solo el envoltorio RPC: resuelve la sesión y delega la lógica
// en `removeGuildMemberHandler`, que vive aparte para poder testearse
// directamente (ver remove-guild-member.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { removeGuildMemberSchema } from '../schemas/guild-schemas'
import { removeGuildMemberHandler } from './remove-guild-member.handler'

export const removeGuildMember = createServerFn({ method: 'POST' })
  .inputValidator(removeGuildMemberSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    return removeGuildMemberHandler(data, session.user.id)
  })
