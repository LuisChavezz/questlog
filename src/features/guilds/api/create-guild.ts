// Acción de servidor — crea un guild y registra a su dueño como miembro
import { randomBytes } from 'node:crypto'

import { createId } from '@paralleldrive/cuid2'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds } from '#/db/schema'
import { auth } from '#/lib/auth'
import { generateCoatOfArmsSvg } from './armoria-client'
import { createGuildSchema } from '../schemas/guild-schemas'

// Alfabeto sin caracteres ambiguos (excluye 0/O, 1/I/l)
const INVITE_CODE_ALPHABET =
  '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
const INVITE_CODE_LENGTH = 8

// Genera una cadena aleatoria del largo indicado usando el alfabeto definido
function generateBaseCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH * 2)
  let code = ''
  for (let i = 0; i < bytes.length && code.length < INVITE_CODE_LENGTH; i++) {
    // Rejection sampling para distribución uniforme sin sesgo
    const limit =
      Math.floor(256 / INVITE_CODE_ALPHABET.length) *
      INVITE_CODE_ALPHABET.length
    if (bytes[i] < limit) {
      code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length]
    }
  }
  // Si los bytes generados no fueron suficientes, reintentar (raro pero posible)
  return code.length === INVITE_CODE_LENGTH ? code : generateBaseCode()
}

// Genera un invite_code único verificando contra la DB; reintenta si hay colisión
async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateBaseCode()
    const existingGuilds = await db
      .select({ id: guilds.id })
      .from(guilds)
      .where(eq(guilds.inviteCode, code))
      .limit(1)
    if (existingGuilds.length === 0) return code
  }
  throw new Error(
    'No se pudo generar un código de invitación único tras varios intentos',
  )
}

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

    // El id se genera acá (en vez de dejarlo al $defaultFn de la tabla) para
    // poder usarlo como seed determinístico del escudo de armas ANTES del
    // insert. La llamada a Armoria es best-effort: si falla o no responde a
    // tiempo, `coatOfArmsSvg` queda en null y la creación del guild sigue
    // adelante igual — es una feature cosmética, no debe poder bloquearla.
    const guildId = createId()
    const coatOfArmsSeed = guildId

    // El invite code y el escudo de armas no dependen entre sí — se generan
    // en paralelo para no sumar la latencia de Armoria (hasta 5s) a la del
    // código de invitación.
    const [inviteCode, coatOfArmsSvg] = await Promise.all([
      generateUniqueInviteCode(),
      generateCoatOfArmsSvg(coatOfArmsSeed),
    ])

    try {
      // Transacción: crear el guild y su membresía de dueño de forma atómica
      const guild = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(guilds)
          .values({
            id: guildId,
            name: data.name,
            slug: data.slug,
            description: data.description ?? null,
            ownerId,
            inviteCode,
            coatOfArmsSeed,
            coatOfArmsSvg,
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
