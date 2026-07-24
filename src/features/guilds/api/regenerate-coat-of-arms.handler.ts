// Lógica de negocio de regenerar el escudo de armas de un guild, separada del
// envoltorio RPC (regenerate-coat-of-arms.ts) — mismo motivo que
// leave-guild.handler.ts: invocable directamente en tests con `#/db` mockeado.
//
// Sirve tanto para "generar por primera vez" (guilds creados antes de esta
// feature, con coatOfArmsSvg null) como para "re-rolar" uno existente: ambos
// casos son la misma operación, no hay que distinguirlos.
import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { guilds } from '#/db/schema'
import { generateCoatOfArmsSvg } from './armoria-client'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'
import { isGuildOwner } from '../role-labels'
import type { RegenerateCoatOfArmsValues } from '../schemas/guild-schemas'

export async function regenerateCoatOfArmsHandler(
  data: RegenerateCoatOfArmsValues,
  userId: string,
) {
  const guild = await resolveGuildBySlugOrThrow(data.slug)

  if (!isGuildOwner(guild.ownerId, userId)) {
    throw new Error(
      'Forbidden: only the guild owner can regenerate the coat of arms',
    )
  }

  // Seed nuevo, distinto del actual: id del guild + un sufijo cuid2 fresco,
  // para garantizar un diseño diferente en cada re-roll (createId() nunca
  // repite, a diferencia de por ejemplo un timestamp de baja resolución).
  const newSeed = `${guild.id}-${createId()}`
  const svg = await generateCoatOfArmsSvg(newSeed)

  // A diferencia de la generación en create-guild.ts (best-effort, silenciosa
  // porque no debe bloquear la creación del guild), acá el usuario está
  // esperando un resultado visible: si Armoria falla, se lo decimos en vez de
  // dejar el escudo actual sin cambios sin ninguna señal de qué pasó.
  if (!svg) {
    throw new Error(
      'Could not generate a new coat of arms right now. Please try again.',
    )
  }

  await db
    .update(guilds)
    .set({ coatOfArmsSeed: newSeed, coatOfArmsSvg: svg })
    .where(eq(guilds.id, guild.id))

  return { coatOfArmsSvg: svg }
}
