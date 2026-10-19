// Helper de servidor — generación de invite codes de guild. Fuente única
// compartida por create-guild (código inicial) y regenerate-invite-code
// (rotación), para que el alfabeto, el largo y la política de colisiones no
// puedan divergir entre ambos.
import { randomBytes } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { guilds } from '#/db/schema'

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
export async function generateUniqueInviteCode(): Promise<string> {
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
    'Could not generate a unique invite code after several attempts',
  )
}
