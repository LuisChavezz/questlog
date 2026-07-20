// Función de servidor — cambia el rol de un miembro (member ↔ admin).
// Solo el owner del guild puede hacerlo; el rol del owner es inmutable aquí.
// Este archivo es solo el envoltorio RPC: resuelve la sesión y delega la lógica
// en `updateGuildMemberRoleHandler`, que vive aparte para poder testearse
// directamente (ver update-guild-member-role.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { updateGuildMemberRoleSchema } from '../schemas/guild-schemas'
import { updateGuildMemberRoleHandler } from './update-guild-member-role.handler'

export const updateGuildMemberRole = createServerFn({ method: 'POST' })
  .inputValidator(updateGuildMemberRoleSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    return updateGuildMemberRoleHandler(data, session.user.id)
  })
