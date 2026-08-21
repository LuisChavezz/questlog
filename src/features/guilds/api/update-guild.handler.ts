// Lógica de negocio de editar el perfil de un guild (nombre y descripción),
// separada del envoltorio RPC (update-guild.ts) — mismo motivo que
// regenerate-coat-of-arms.handler.ts: invocable directamente en tests con
// `#/db` mockeado.
//
// A diferencia de los endpoints de gestión de miembros, acá NO hace falta la
// reverificación bajo bloqueo de fila: esta escritura no lee nada para decidir
// qué escribir ni deja filas relacionadas inconsistentes, así que la propiedad
// se puede reverificar de forma ATÓMICA metiéndola en el WHERE del propio
// UPDATE. Eso cierra la misma ventana TOCTOU que el resto de handlers cierra
// con SELECT … FOR UPDATE —una transferencia de propiedad que confirme entre la
// lectura y la escritura ya no deja al ex-owner renombrar el guild— sin agregar
// contención contra los endpoints que sí bloquean `guilds`.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guilds } from '#/db/schema'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'
import { isGuildOwner } from '../role-labels'
import type { UpdateGuildValues } from '../schemas/guild-schemas'

export async function updateGuildHandler(
  data: UpdateGuildValues,
  userId: string,
) {
  const guild = await resolveGuildBySlugOrThrow(data.slug)

  if (!isGuildOwner(guild.ownerId, userId)) {
    throw new Error('Forbidden: only the guild owner can edit this guild')
  }

  // Cadena vacía → NULL. La columna es nullable y el resto de la app trata la
  // descripción ausente como "no hay descripción" (el header la omite del
  // render); guardar '' metería un tercer estado indistinguible en la UI pero
  // distinto en la BD, que cada lectura tendría que normalizar por su cuenta.
  const description = data.description === '' ? null : data.description

  // El `ownerId` va en el WHERE, no solo en el check de arriba: es la
  // reverificación de la propiedad, evaluada por el motor en el mismo statement
  // que la escritura. Y `returning()` distingue "no afectó ninguna fila" de un
  // guardado real — sin él, un guild borrado concurrentemente devolvería éxito y
  // la UI confirmaría un guardado que nunca ocurrió.
  const updated = await db
    .update(guilds)
    .set({ name: data.name, description })
    .where(and(eq(guilds.id, guild.id), eq(guilds.ownerId, userId)))
    .returning({ id: guilds.id })

  // Cero filas solo puede significar cambio concurrente: el check previo ya
  // pasó, así que o el guild se borró o la propiedad cambió de manos.
  if (updated.length === 0) {
    throw new Error(
      'Conflict: the guild changed while saving — please refresh and try again',
    )
  }

  return { success: true }
}
