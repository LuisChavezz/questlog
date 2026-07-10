// Helper de servidor — localiza un guild por slug o lanza "Not Found".
// Reúne la búsqueda que, de lo contrario, se repetiría en cada endpoint de
// gestión de miembros (leave / remove / transfer / update-role): un único lugar
// para el criterio de selección, el mensaje de error y, a futuro, filtros como
// un posible borrado lógico.
import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { guilds } from '#/db/schema'

// Devuelve el id y el dueño estructural (guilds.owner_id) del guild, o lanza si
// no existe. No verifica sesión ni permisos: eso es responsabilidad de cada
// endpoint, que ya resuelve la autorización sobre estos datos.
export async function resolveGuildBySlugOrThrow(slug: string) {
  const guildsFound = await db
    .select({ id: guilds.id, ownerId: guilds.ownerId })
    .from(guilds)
    .where(eq(guilds.slug, slug))
    .limit(1)

  if (guildsFound.length === 0) {
    throw new Error('Not Found: guild not found')
  }

  return guildsFound[0]
}
