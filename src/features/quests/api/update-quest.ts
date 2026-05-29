// Función de servidor — actualiza una quest existente del usuario autenticado
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { quests } from '#/db/schema'
import { auth } from '#/lib/auth'
import {
  parseQuestDueDateValue,
  updateQuestSchema,
} from '../schemas/quest-schemas'

export const updateQuest = createServerFn({ method: 'POST' })
  .inputValidator(updateQuestSchema)
  .handler(async ({ data }) => {
    // Verificar sesión activa
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to update a quest')
    }

    // Construir el payload de actualización con los campos provistos
    const updatePayload: Record<string, unknown> = {}

    if (data.title !== undefined) {
      updatePayload.title = data.title
    }

    if (data.status !== undefined) {
      updatePayload.status = data.status
      // Registrar la fecha de finalización cuando la quest se marca como completada
      updatePayload.completedAt = data.status === 'done' ? new Date() : null
    }

    if (data.priority !== undefined) {
      updatePayload.priority = data.priority
    }

    if (data.tags !== undefined) {
      updatePayload.tags = data.tags
    }

    if (data.dueDate !== undefined) {
      updatePayload.dueDate = parseQuestDueDateValue(data.dueDate)
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new Error('No fields to update')
    }

    // La cláusula WHERE incluye userId para evitar actualizaciones cruzadas
    const [quest] = await db
      .update(quests)
      .set(updatePayload)
      .where(
        and(
          eq(quests.id, data.id),
          eq(quests.userId, session.user.id),
        ),
      )
      .returning()

    return quest
  })

export type UpdatedQuest = NonNullable<Awaited<ReturnType<typeof updateQuest>>>
