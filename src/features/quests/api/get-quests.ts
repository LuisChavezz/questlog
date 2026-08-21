// Función de servidor — obtiene las quests que el usuario autenticado ve en su
// lista personal: las suyas sin guild más las de guild donde es creador,
// supervisor o asignado. El criterio exacto vive en `buildVisibleQuestsFilter`,
// compartido con `getQuestGuilds` para que ambas queries describan el mismo
// conjunto de filas (si divergen, la lista personal pintaría quests sin
// sección de guild donde vivir, o secciones sin quests).
//
// Devuelve `Quest[]` a secas (sin datos del guild embebidos): la caché
// `['quests']` es un array de `Quest` sobre el que operan todos los hooks de
// mutación optimista. El nombre y roster del guild para agrupar la tabla los
// resuelve el cliente contra `questGuildsQueryOptions` (`getQuestGuilds`), que
// hace sus propios JOINs (guilds ⋈ guild_members ⋈ user) en una query aparte —
// mantener esta query plana es lo que preserva la forma de la caché.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { desc } from 'drizzle-orm'

import { db } from '#/db'
import { quests } from '#/db/schema'
import { auth } from '#/lib/auth'
import { buildVisibleQuestsFilter } from './visible-quests-filter'

export const getQuests = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user.id) {
    throw new Error('Unauthorized: must be signed in to fetch quests')
  }

  const result = await db
    .select()
    .from(quests)
    .where(buildVisibleQuestsFilter(session.user.id))
    .orderBy(desc(quests.createdAt))

  return result
})
