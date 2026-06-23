// Acción de servidor — crea un guild y registra a su dueño como miembro
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { db } from '#/db'
import { guildMembers, guilds } from '#/db/schema'
import { auth } from '#/lib/auth'
import { createGuildSchema } from '../schemas/guild-schemas'

export const createGuild = createServerFn({ method: 'POST' })
  .inputValidator(createGuildSchema)
  .handler(async ({ data }) => {
    // Obtener sesión activa desde la request
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to create a guild')
    }

    const ownerId = session.user.id

    try {
      // Transacción: crear el guild y su membresía de dueño de forma atómica
      const guild = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(guilds)
          .values({
            name: data.name,
            slug: data.slug,
            description: data.description ?? null,
            ownerId,
          })
          .returning()

        await tx.insert(guildMembers).values({
          guildId: created.id,
          userId: ownerId,
          role: 'owner',
        })

        return created
      })

      return guild
    } catch (err) {
      // Violación de unicidad de Postgres (slug duplicado) → mensaje legible
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        err.code === '23505'
      ) {
        throw new Error(
          'A guild with this slug already exists. Try another one.',
        )
      }

      throw err
    }
  })

// Tipo de retorno de la acción
export type CreatedGuild = NonNullable<Awaited<ReturnType<typeof createGuild>>>
