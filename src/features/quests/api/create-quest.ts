// Acción de servidor — crea una nueva quest asociada al usuario autenticado
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { db } from '#/db'
import { quests } from '#/db/schema'
import { auth } from '#/lib/auth'
import {
  createQuestSchema,
  parseQuestDueDateValue,
} from '../schemas/quest-schemas'

export const createQuest = createServerFn({ method: 'POST' })
  .inputValidator(createQuestSchema)
  .handler(async ({ data }) => {
    // Obtener sesión activa desde la request
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to create a quest')
    }

    // Transformar tags de string CSV a array de strings limpias
    const tagsArray = data.tags
      ? data.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
      : []

    // Transformar dueDate de string a Date si está presente
    const dueDate = parseQuestDueDateValue(data.dueDate ?? '')

    const [quest] = await db
      .insert(quests)
      .values({
        ownerId: session.user.id,
        title: data.title,
        description: data.description ?? null,
        status: 'backlog',
        priority: data.priority,
        tags: tagsArray,
        dueDate,
      })
      .returning()

    return quest
  })

// Tipo de retorno de la acción
export type CreatedQuest = NonNullable<Awaited<ReturnType<typeof createQuest>>>
