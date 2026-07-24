// Función de servidor — actividad reciente de un guild (tarjeta "Recent
// Activity", top 5). Solo el envoltorio RPC: resuelve la sesión y delega en
// `getGuildRecentActivityHandler` (que vive aparte para poder testearse directo).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { getGuildInputSchema } from '../schemas/guild-schemas'
import { getGuildRecentActivityHandler } from './get-guild-recent-activity.handler'

export const getGuildRecentActivity = createServerFn({ method: 'GET' })
  .inputValidator(getGuildInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to view guild activity')
    }

    return getGuildRecentActivityHandler(data.slug, session.user.id)
  })
