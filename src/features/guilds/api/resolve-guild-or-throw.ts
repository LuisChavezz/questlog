// Helper de servidor — localiza un guild por slug o lanza "Not Found".
// Reúne la búsqueda que, de lo contrario, se repetiría en cada endpoint de
// gestión de miembros (leave / remove / transfer / update-role): un único lugar
// para el criterio de selección, el mensaje de error y, a futuro, filtros como
// un posible borrado lógico.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds } from '#/db/schema'

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

// Verifica que `userId` sea miembro vigente de `guildId`, o lanza "Forbidden".
// Puerta de autorización compartida por los endpoints de lectura del guild
// (mismo mensaje y criterio que el check inline que tenían `getGuild`/
// `getGuildQuests`) — un único lugar para "¿puede este usuario ver datos de este
// guild?". Devuelve la membresía (con su rol) para el llamador que además lo
// necesite —p. ej. `getGuild` expone `currentUserRole`— y así no repetir la
// misma consulta; quien solo use la puerta puede ignorar el valor de retorno.
export async function assertGuildMembershipOrThrow(
  guildId: string,
  userId: string,
) {
  const memberships = await db
    .select({ role: guildMembers.role })
    .from(guildMembers)
    .where(
      and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)),
    )
    .limit(1)

  if (memberships.length === 0) {
    throw new Error('Forbidden: you are not a member of this guild')
  }

  return memberships[0]
}
