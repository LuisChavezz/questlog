// Función de servidor — actualiza una quest existente del usuario autenticado.
// Este archivo es solo el envoltorio RPC: resuelve la sesión y delega la lógica
// en `updateQuestHandler`, que vive aparte para poder testearse directamente
// (ver update-quest.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { updateQuestSchema } from '../schemas/quest-schemas'
import { updateQuestHandler } from './update-quest.handler'

export const updateQuest = createServerFn({ method: 'POST' })
  .inputValidator(updateQuestSchema)
  .handler(async ({ data }) => {
    // Verificar sesión activa
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to update a quest')
    }

    return updateQuestHandler(data, session.user.id)
  })

export type UpdatedQuest = NonNullable<Awaited<ReturnType<typeof updateQuest>>>
