// Función de servidor — elimina una quest del usuario autenticado. Solo el
// envoltorio RPC: resuelve la sesión y delega en `deleteQuestHandler`, que vive
// aparte para poder testearse directamente (ver delete-quest.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { deleteQuestSchema } from '../schemas/quest-schemas'
import { deleteQuestHandler } from './delete-quest.handler'

export const deleteQuest = createServerFn({ method: 'POST' })
  .inputValidator(deleteQuestSchema)
  .handler(async ({ data }) => {
    // Verificar sesión activa
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to delete a quest')
    }

    return deleteQuestHandler(data, session.user.id)
  })

export type DeletedQuest = NonNullable<Awaited<ReturnType<typeof deleteQuest>>>
