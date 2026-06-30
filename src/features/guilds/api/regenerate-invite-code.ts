// Acción de servidor — regenera el invite_code de un guild verificando ownership
import { randomBytes } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { guilds } from '#/db/schema'
import { auth } from '#/lib/auth'
import { regenerateInviteCodeSchema } from '../schemas/guild-schemas'

// Alfabeto sin caracteres ambiguos (excluye 0/O, 1/I/l) — idéntico al de create-guild
const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
const INVITE_CODE_LENGTH = 8

function generateBaseCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH * 2)
  let code = ''
  for (let i = 0; i < bytes.length && code.length < INVITE_CODE_LENGTH; i++) {
    const limit = Math.floor(256 / INVITE_CODE_ALPHABET.length) * INVITE_CODE_ALPHABET.length
    if (bytes[i] < limit) {
      code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length]
    }
  }
  return code.length === INVITE_CODE_LENGTH ? code : generateBaseCode()
}

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
  throw new Error('No se pudo generar un código de invitación único tras varios intentos')
}

export const regenerateInviteCode = createServerFn({ method: 'POST' })
  .inputValidator(regenerateInviteCodeSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    // Verificar que el guild existe y que el usuario es el owner
    const matchingGuilds = await db
      .select({ id: guilds.id, ownerId: guilds.ownerId })
      .from(guilds)
      .where(eq(guilds.id, data.guildId))
      .limit(1)

    if (matchingGuilds.length === 0) {
      throw new Error('Not Found: guild not found')
    }

    const [guild] = matchingGuilds

    if (guild.ownerId !== session.user.id) {
      throw new Error('Forbidden: only the guild owner can regenerate the invite code')
    }

    const newInviteCode = await generateUniqueInviteCode()

    await db
      .update(guilds)
      .set({ inviteCode: newInviteCode })
      .where(eq(guilds.id, data.guildId))

    return { inviteCode: newInviteCode }
  })
