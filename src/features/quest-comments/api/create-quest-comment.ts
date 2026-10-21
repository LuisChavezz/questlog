// Función de servidor — publica un comentario en una quest de guild. Solo el
// envoltorio RPC: resuelve la sesión y delega en el handler, que vive aparte
// para poder testearse directo (ver create-quest-comment.handler.ts).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'
import { createQuestCommentSchema } from '../schemas/quest-comment-schemas'
import { createQuestCommentHandler } from './create-quest-comment.handler'

export const createQuestComment = createServerFn({ method: 'POST' })
  .inputValidator(createQuestCommentSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to post a comment')
    }

    return createQuestCommentHandler(data, session.user.id)
  })
