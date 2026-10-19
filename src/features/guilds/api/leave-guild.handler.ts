// Lógica de negocio de abandonar un guild, separada del envoltorio RPC
// (leave-guild.ts). El envoltorio solo resuelve la sesión y delega aquí; esta
// función recibe el `userId` ya autenticado y el `data` ya validado, así que es
// invocable directamente en tests con `#/db` mockeado — sin depender del
// transform del plugin de TanStack Start, que no está activo bajo Vitest y hace
// que un server fn llamado directo resuelva a `undefined`.
//
// Mismo esquema que remove-guild-member: comprobación previa sin bloqueo (decide
// el error que ve el usuario) y reverificación dentro de la transacción contra
// la fila de membresía bloqueada, seguida del borrado y de la limpieza de
// asignado/supervisor en las quests del guild.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds, quests } from '#/db/schema'
import { isGuildOwner } from '../role-labels'
import type { LeaveGuildValues } from '../schemas/guild-schemas'
import { withDeadlockRetry } from '#/lib/server/deadlock-retry'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

// Conflicto genérico de la salida: la membresía cambió entre la comprobación
// previa y la escritura. Se comparte con el reintento por deadlock para que un
// choque de bloqueos irresoluble se vea igual que cualquier otra carrera
// perdida, en vez de filtrar el error crudo de Postgres.
const MEMBERSHIP_CHANGED_CONFLICT =
  'Conflict: your membership changed while leaving — please refresh and try again'

export async function leaveGuildHandler(
  data: LeaveGuildValues,
  userId: string,
) {
  // Localizar el guild y su dueño estructural (guilds.owner_id)
  const guild = await resolveGuildBySlugOrThrow(data.slug)

  // El owner debe transferir la propiedad antes de salir. Se verifica contra
  // guilds.owner_id (no contra guild_members.role) para no permitir un bypass
  // por drift — mismo patrón defensivo que transfer-guild-ownership.
  if (isGuildOwner(guild.ownerId, userId)) {
    throw new Error(
      'Forbidden: you must transfer ownership before leaving this guild',
    )
  }

  // Membresía de quien sale (lectura sin bloqueo): decide el error visible si
  // no pertenece al guild.
  const memberships = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(
      and(eq(guildMembers.guildId, guild.id), eq(guildMembers.userId, userId)),
    )
    .limit(1)

  if (memberships.length === 0) {
    throw new Error('Forbidden: you are not a member of this guild')
  }

  // Salida bajo transacción con relectura bloqueada. El check de arriba usa una
  // lectura que podría quedar obsoleta frente a una transferencia de propiedad
  // concurrente HACIA quien sale: si esa transferencia confirma y después se
  // borra su fila, guilds.owner_id quedaría apuntando a un usuario sin
  // membresía y nadie podría administrar el guild.
  //
  // Orden de bloqueos, idéntico al de remove-guild-member: primero la fila de
  // membresía de quien sale (la única que se bloquea), luego el owner
  // estructural releído SIN bloqueo y, al final, las filas de quests que toca
  // la limpieza. transfer-guild-ownership y delete-guild toman `guilds` y
  // después `guild_members`; aquí `guilds` nunca se bloquea, así que contra
  // ellos no se invierte ningún orden.
  //
  // Riesgo de deadlock (el mismo que tiene remove-guild-member): esta
  // transacción retiene la membresía y después toca `quests`, al revés que
  // update-quest (quests → guild_members), y la cascada de delete-guild puede
  // cruzarse con ambas. Ningún orden los satisface a todos, así que se absorbe
  // reintentando la transacción una vez con `withDeadlockRetry`.
  return withDeadlockRetry(
    () =>
      db.transaction(async (tx) => {
        // Bloquear (FOR UPDATE) la membresía de quien sale. Una transferencia que lo
        // promueva a owner debe escribir esta misma fila, así que el bloqueo nos
        // serializa contra ella.
        const lockedMemberships = await tx
          .select({ id: guildMembers.id })
          .from(guildMembers)
          .where(
            and(
              eq(guildMembers.guildId, guild.id),
              eq(guildMembers.userId, userId),
            ),
          )
          .limit(1)
          .for('update')

        // La comprobación previa acaba de pasar: si ya no hay membresía, otra
        // transacción la borró entre medias (p. ej. una expulsión simultánea).
        if (lockedMemberships.length === 0) {
          throw new Error(MEMBERSHIP_CHANGED_CONFLICT)
        }

        // Releer el owner estructural DESPUÉS de tomar el bloqueo: así refleja una
        // transferencia ya confirmada. Lectura sin bloqueo (MVCC) a propósito, para
        // no invertir el orden de bloqueos respecto a transfer-guild-ownership
        // (guilds → guild_members); como la transferencia escribe la fila de quien
        // la recibe, el bloqueo de arriba ya nos serializa contra ella.
        const lockedGuilds = await tx
          .select({ ownerId: guilds.ownerId })
          .from(guilds)
          .where(eq(guilds.id, guild.id))
          .limit(1)

        // El guild desapareció entre la comprobación previa y el bloqueo
        // (borrado concurrente): no hay nada de lo que salir.
        if (lockedGuilds.length === 0) {
          throw new Error(
            'Conflict: this guild no longer exists — please refresh and try again',
          )
        }

        // Si quien sale es ahora el owner (una transferencia ganó la carrera),
        // abortar en vez de dejar el guild con un owner sin fila de membresía.
        if (isGuildOwner(lockedGuilds[0].ownerId, userId)) {
          throw new Error(
            'Conflict: you are now the guild owner — please refresh and try again',
          )
        }

        // Borrar la membresía; returning() confirma que la fila seguía ahí al
        // escribir (con el bloqueo tomado no debería poder faltar).
        const removed = await tx
          .delete(guildMembers)
          .where(
            and(
              eq(guildMembers.guildId, guild.id),
              eq(guildMembers.userId, userId),
            ),
          )
          .returning({ id: guildMembers.id })

        if (removed.length === 0) {
          throw new Error(MEMBERSHIP_CHANGED_CONFLICT)
        }

        // Limpiar asignado/supervisor, exactamente como remove-guild-member: quien
        // sale deja de ser miembro, así que ninguna quest del guild puede seguir
        // apuntándolo en esos campos (si volviera a unirse, recuperaría en silencio
        // el eje 2 sobre ellas). Misma transacción que el borrado de la membresía, y
        // solo quests DE ESTE guild; la autoría (ownerId) no se toca.
        await tx
          .update(quests)
          .set({ assigneeId: null })
          .where(
            and(eq(quests.guildId, guild.id), eq(quests.assigneeId, userId)),
          )

        await tx
          .update(quests)
          .set({ supervisorId: null })
          .where(
            and(eq(quests.guildId, guild.id), eq(quests.supervisorId, userId)),
          )

        return { slug: data.slug }
      }),
    MEMBERSHIP_CHANGED_CONFLICT,
  )
}
