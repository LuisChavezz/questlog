// Función de servidor — obtiene todas las quests de la base de datos
import { createServerFn } from '@tanstack/react-start'
import { asc } from 'drizzle-orm'

import { db } from '#/db'
import { quests } from '#/db/schema'

export const getQuests = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await db.select().from(quests).orderBy(asc(quests.createdAt))
  return result
})
