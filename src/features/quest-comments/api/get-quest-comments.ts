// Función de servidor — una página del hilo de comentarios de una quest de
// guild. Solo el envoltorio RPC: resuelve la sesión y delega en
// `getQuestCommentsHandler` (que vive aparte para poder testearse directo).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { getQuestCommentsSchema } from '../schemas/quest-comment-schemas'
import { getQuestCommentsHandler } from './get-quest-comments.handler'

export const getQuestComments = createServerFn({ method: 'GET' })
  .inputValidator(getQuestCommentsSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to view comments')
    }

    return getQuestCommentsHandler(data, session.user.id)
  })
