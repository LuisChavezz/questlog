// Acción de servidor — crea una nueva quest asociada al usuario autenticado.
// Solo el envoltorio RPC: resuelve la sesión y delega en `createQuestHandler`,
// que vive aparte para poder testearse directamente (ver create-quest.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { createQuestSchema } from '../schemas/quest-schemas'
import { createQuestHandler } from './create-quest.handler'

export const createQuest = createServerFn({ method: 'POST' })
  .inputValidator(createQuestSchema)
  .handler(async ({ data }) => {
    // Obtener sesión activa desde la request
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to create a quest')
    }

    return createQuestHandler(data, session.user.id)
  })

// Tipo de retorno de la acción
export type CreatedQuest = NonNullable<Awaited<ReturnType<typeof createQuest>>>
