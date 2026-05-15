import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '#/db/index'
import { account, session, user, verification } from '#/db/auth-schema'

// Configuración del servidor de autenticación con Better Auth + Drizzle (Postgres/Supabase)
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    // Mapeo explícito de modelos Better Auth → tablas Drizzle
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies()],
})
