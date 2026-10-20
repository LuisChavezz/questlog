import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '#/db/index'
import { account, session, user, verification } from '#/db/auth-schema'
import { resolveAuthOrigins } from '#/lib/auth-origins'

// URL base y orígenes de confianza por entorno (ver auth-origins.ts)
const { baseURL, trustedOrigins } = resolveAuthOrigins(process.env)

// Configuración del servidor de autenticación con Better Auth + Drizzle (Postgres/Supabase)
export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    // Mapeo explícito de modelos Better Auth → tablas Drizzle
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    // Campos extra del usuario. `avatarId` referencia una entrada del catálogo
    // estático (avatarCatalog); se expone en la sesión pero solo el servidor
    // puede escribirlo (input: false) para evitar valores arbitrarios del cliente.
    additionalFields: {
      avatarId: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  plugins: [tanstackStartCookies()],
})
