// Función de servidor — edita un comentario de una quest de guild. Solo el
// envoltorio RPC: resuelve la sesión y delega en el handler, que vive aparte
// para poder testearse directo (ver update-quest-comment.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { updateQuestCommentSchema } from '../schemas/quest-comment-schemas'
import { updateQuestCommentHandler } from './update-quest-comment.handler'

export const updateQuestComment = createServerFn({ method: 'POST' })
  .inputValidator(updateQuestCommentSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to edit a comment')
    }

    return updateQuestCommentHandler(data, session.user.id)
  })
