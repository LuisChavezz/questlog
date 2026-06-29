// Función de servidor — elimina una quest del usuario autenticado
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { quests } from '#/db/schema'
import { auth } from '#/lib/auth'
import { deleteQuestSchema } from '../schemas/quest-schemas'

export const deleteQuest = createServerFn({ method: 'POST' })
  .inputValidator(deleteQuestSchema)
  .handler(async ({ data }) => {
    // Verificar sesión activa
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to delete a quest')
    }

    // La cláusula WHERE incluye ownerId para evitar eliminaciones cruzadas
    const [quest] = await db
      .delete(quests)
      .where(
        and(
          eq(quests.id, data.id),
          eq(quests.ownerId, session.user.id),
        ),
      )
      .returning()

    return quest
  })

export type DeletedQuest = NonNullable<Awaited<ReturnType<typeof deleteQuest>>>
