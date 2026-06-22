// Función de servidor — elimina múltiples quests del usuario autenticado
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '#/db'
import { quests } from '#/db/schema'
import { auth } from '#/lib/auth'
import { deleteQuestsSchema } from '../schemas/quest-schemas'

export const deleteQuests = createServerFn({ method: 'POST' })
  .inputValidator(deleteQuestsSchema)
  .handler(async ({ data }) => {
    // Verificar sesión activa
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to delete quests')
    }

    // La cláusula WHERE combina inArray con userId para eliminar solo las quests
    // seleccionadas que pertenecen al usuario y evitar eliminaciones cruzadas
    const deleted = await db
      .delete(quests)
      .where(
        and(
          inArray(quests.id, data.ids),
          eq(quests.userId, session.user.id),
        ),
      )
      .returning()

    return deleted
  })

export type DeletedQuests = Awaited<ReturnType<typeof deleteQuests>>
