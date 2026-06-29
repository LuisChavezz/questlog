// Función de servidor — obtiene las quests del usuario autenticado
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { asc, eq } from 'drizzle-orm'

import { db } from '#/db'
import { quests } from '#/db/schema'
import { auth } from '#/lib/auth'

export const getQuests = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user.id) {
    throw new Error('Unauthorized: must be signed in to fetch quests')
  }

  const result = await db
    .select()
    .from(quests)
    .where(eq(quests.ownerId, session.user.id))
    .orderBy(asc(quests.createdAt))

  return result
})
