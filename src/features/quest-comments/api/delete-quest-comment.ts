// Función de servidor — borra un comentario de una quest de guild. Solo el
// envoltorio RPC: resuelve la sesión y delega en el handler, que vive aparte
// para poder testearse directo (ver delete-quest-comment.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { deleteQuestCommentSchema } from '../schemas/quest-comment-schemas'
import { deleteQuestCommentHandler } from './delete-quest-comment.handler'

export const deleteQuestComment = createServerFn({ method: 'POST' })
  .inputValidator(deleteQuestCommentSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to delete a comment')
    }

    return deleteQuestCommentHandler(data, session.user.id)
  })
