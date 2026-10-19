// Lógica de negocio de regenerar el invite code de un guild, separada del
// envoltorio RPC (regenerate-invite-code.ts) — mismo motivo que
// leave-guild.handler.ts: invocable directamente en tests con `#/db` mockeado.
//
// Igual que update-guild.handler.ts, la propiedad se reverifica de forma
// ATÓMICA en el WHERE del propio UPDATE en vez de con SELECT … FOR UPDATE: es
// una escritura de una sola fila de `guilds` que no deja filas relacionadas
// inconsistentes, así que basta con que el motor no encuentre fila si la
// propiedad cambió de manos entre la comprobación previa y la escritura.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guilds } from '#/db/schema'
import { isGuildOwner } from '../role-labels'
import type { RegenerateInviteCodeValues } from '../schemas/guild-schemas'
import { generateUniqueInviteCode } from './invite-code'

export async function regenerateInviteCodeHandler(
  data: RegenerateInviteCodeValues,
  userId: string,
) {
  // Verificar que el guild existe y que el usuario es su dueño estructural
  const matchingGuilds = await db
    .select({ id: guilds.id, ownerId: guilds.ownerId })
    .from(guilds)
    .where(eq(guilds.id, data.guildId))
    .limit(1)

  if (matchingGuilds.length === 0) {
    throw new Error('Not Found: guild not found')
  }

  const [guild] = matchingGuilds

  if (!isGuildOwner(guild.ownerId, userId)) {
    throw new Error(
      'Forbidden: only the guild owner can regenerate the invite code',
    )
  }

  const newInviteCode = await generateUniqueInviteCode()

  // El `ownerId` va en el WHERE: es la reverificación de la propiedad,
  // evaluada por el motor en el mismo statement que la escritura. returning()
  // distingue "no afectó ninguna fila" de un cambio real.
  const updated = await db
    .update(guilds)
    .set({ inviteCode: newInviteCode })
    .where(and(eq(guilds.id, guild.id), eq(guilds.ownerId, userId)))
    .returning({ id: guilds.id })

  // Cero filas con el check previo ya superado solo puede ser un cambio
  // concurrente: el guild se borró o la propiedad cambió de manos.
  if (updated.length === 0) {
    throw new Error(
      'Conflict: the guild changed while regenerating the invite code — please refresh and try again',
    )
  }

  return { inviteCode: newInviteCode }
}
