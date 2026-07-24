// Función de servidor — historial de actividad paginado de un guild (modal "View
// all"). Solo el envoltorio RPC: resuelve la sesión y delega en
// `getGuildActivityHistoryHandler` (que vive aparte para poder testearse directo).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { getGuildActivityHistorySchema } from '../schemas/guild-schemas'
import { getGuildActivityHistoryHandler } from './get-guild-activity-history.handler'

export const getGuildActivityHistory = createServerFn({ method: 'GET' })
  .inputValidator(getGuildActivityHistorySchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to view guild activity')
    }

    return getGuildActivityHistoryHandler(data, session.user.id)
  })
