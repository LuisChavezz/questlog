// Lógica de negocio del borrado de un guild, separada del envoltorio RPC
// (delete-guild.ts). El envoltorio solo resuelve la sesión y delega aquí; esta
// función recibe el `requesterId` ya autenticado y el `data` ya validado, así que
// es invocable directamente en tests con `#/db` mockeado — sin depender del
// transform del plugin de TanStack Start, que no está activo bajo Vitest y hace
// que un server fn llamado directo resuelva a `undefined`.
//
// Acción IRREVERSIBLE y de máxima consecuencia: borra el guild y, por cascada de
// claves foráneas declarada en el esquema, todo lo que cuelga de él:
//
//   guilds
//     ├─ guild_members            (guild_id CASCADE)
//     └─ quests                   (guild_id CASCADE)
//          └─ guild_quest_activity_log (quest_id CASCADE)
//     └─ guild_quest_activity_log (guild_id CASCADE)
//
// Por eso aquí se emite UNA sola escritura: `DELETE FROM guilds WHERE id = …`.
// Borrar a mano las tablas hijas duplicaría lo que el esquema ya garantiza y
// podría quedar desincronizado con él (una tabla nueva que cascadee y nadie
// añada aquí pasaría inadvertida); la cascada es la fuente de verdad.
//
// La propiedad se REVERIFICA dentro de la transacción contra una lectura con
// bloqueo de fila (`FOR UPDATE`), no contra el snapshot leído antes de abrirla —
// mismo patrón que transfer-guild-ownership. Cierra el TOCTOU entre el momento
// en que la UI pinta el botón (o el request entra) y el momento del borrado: si
// entremedias otra transacción transfirió la propiedad, el ex-owner ya no puede
// borrar el guild y la operación aborta con un conflicto. El bloqueo se toma
// sobre `guilds` ANTES de tocar `guild_members`/`quests` (que la cascada borra),
// el mismo orden de adquisición que transfer-guild-ownership — así esas dos no
// pueden bloquearse en círculo.
//
// Con update-quest SÍ hay riesgo de deadlock: ese handler bloquea la quest
// primero y solo después toca `guilds` (vía la FK de la bitácora), justo el
// orden contrario al de aquí. No se reordena ninguno de los dos —cada orden lo
// exigen los invariantes de su handler—; se absorbe reintentando la transacción
// una vez, que es lo que `withDeadlockRetry` documenta y hace.
import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { guilds } from '#/db/schema'
import { withDeadlockRetry } from '#/lib/server/deadlock-retry'
import { isGuildOwner } from '../role-labels'
import type { DeleteGuildValues } from '../schemas/guild-schemas'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

// Conflicto genérico del borrado: la fila dejó de estar donde se esperaba entre
// el snapshot y la escritura. Se comparte con el reintento por deadlock para que
// un choque de bloqueos irresoluble se vea igual que cualquier otra carrera
// perdida, en vez de filtrar el «deadlock detected» crudo de Postgres a la UI.
const GUILD_CHANGED_CONFLICT =
  'Conflict: the guild changed while deleting — please refresh and try again'

export async function deleteGuildHandler(
  data: DeleteGuildValues,
  requesterId: string,
) {
  // Localizar el guild y su dueño estructural (guilds.owner_id). Se resuelve
  // ANTES de la autorización —igual que en los endpoints hermanos— para que un
  // slug inexistente devuelva "Not Found" y no un "Forbidden" que despistaría.
  const guild = await resolveGuildBySlugOrThrow(data.slug)

  // Solo el Guild Master borra el guild. Se decide contra guilds.owner_id vía
  // `isGuildOwner` (la fuente única de verdad de la propiedad, la misma que usan
  // la UI y el resto de endpoints) y no contra guild_members.role, que ante un
  // drift permitiría un bypass. Un Officer (admin) o un Member caen aquí.
  if (!isGuildOwner(guild.ownerId, requesterId)) {
    throw new Error('Forbidden: only the guild owner can delete this guild')
  }

  // El reintento envuelve la transacción ENTERA, no una parte: si Postgres la
  // aborta por deadlock, la segunda pasada vuelve a bloquear la fila y a
  // reverificar la propiedad desde cero, sin reanudar nada del intento muerto.
  const result = await withDeadlockRetry(
    () =>
      db.transaction(async (tx) => {
        // Relectura del guild con bloqueo exclusivo de la fila (`FOR UPDATE`).
        // Serializa el borrado contra una transferencia de propiedad concurrente:
        // mientras esta transacción no confirme, la otra queda a la espera sobre
        // la misma fila (y viceversa).
        const lockedGuilds = await tx
          .select({ id: guilds.id, ownerId: guilds.ownerId })
          .from(guilds)
          .where(eq(guilds.slug, data.slug))
          .limit(1)
          .for('update')

        // La fila existía en la lectura previa; si ya no está, otro borrado
        // concurrente ganó la carrera. Se trata como conflicto.
        if (lockedGuilds.length === 0) {
          throw new Error(GUILD_CHANGED_CONFLICT)
        }

        const lockedGuild = lockedGuilds[0]

        // Verificación AUTORITATIVA contra la lectura bloqueada. El check de
        // arriba ya confirmó la propiedad sobre el snapshot, así que si aquí ya
        // no se cumple solo puede deberse a una transferencia que ganó la
        // carrera: abortamos en vez de dejar que un ex-owner arrastre el guild
        // entero. No es un deadlock, así que no se reintenta: falla y punto.
        if (!isGuildOwner(lockedGuild.ownerId, requesterId)) {
          throw new Error(
            'Conflict: ownership has already changed — please refresh and try again',
          )
        }

        // Única escritura: el borrado del guild. Acotada por su id (no por el
        // slug) para que solo caiga la fila que acabamos de bloquear y
        // verificar; el resto de guilds —sus miembros, quests y bitácora— queda
        // intacto porque las cascadas van todas por guild_id. returning()
        // confirma que la fila seguía existiendo al escribir.
        const deleted = await tx
          .delete(guilds)
          .where(eq(guilds.id, lockedGuild.id))
          .returning({ id: guilds.id })

        if (deleted.length === 0) {
          throw new Error(GUILD_CHANGED_CONFLICT)
        }

        return { guildId: lockedGuild.id, slug: data.slug }
      }),
    GUILD_CHANGED_CONFLICT,
  )

  return result
}
