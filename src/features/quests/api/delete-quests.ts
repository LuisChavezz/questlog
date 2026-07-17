// Función de servidor — elimina múltiples quests del usuario autenticado. Solo
// el envoltorio RPC: resuelve la sesión y delega en `deleteQuestsHandler`, que
// vive aparte para poder testearse directamente (ver delete-quests.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { deleteQuestsSchema } from '../schemas/quest-schemas'
import { deleteQuestsHandler } from './delete-quests.handler'

export const deleteQuests = createServerFn({ method: 'POST' })
  .inputValidator(deleteQuestsSchema)
  .handler(async ({ data }) => {
    // Verificar sesión activa
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to delete quests')
    }

    return deleteQuestsHandler(data, session.user.id)
  })

export type DeletedQuests = Awaited<ReturnType<typeof deleteQuests>>
