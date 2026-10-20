import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '#/db/index'
import { account, session, user, verification } from '#/db/auth-schema'

// Dominios de producción del proyecto en Vercel (aliases del deployment de
// producción). Única fuente de los orígenes de producción en este archivo.
const PRODUCTION_HOSTS = [
  'questlog-neon.vercel.app',
  'questlog-neon-ten.vercel.app',
  'questlog-luis-alberto-ceja-chavezs-projects.vercel.app',
]

// URLs de preview de ESTE proyecto, nunca *.vercel.app entero:
// - por commit: questlog-<hash de 9 caracteres>-<scope>.vercel.app
// - por rama:   questlog-git-<rama>-<scope>.vercel.app
// `?` y `*` son los comodines de Better Auth (ninguno cruza un `/`).
const PREVIEW_HOST_PATTERNS = [
  'questlog-?????????-luis-alberto-ceja-chavezs-projects.vercel.app',
  'questlog-git-*-luis-alberto-ceja-chavezs-projects.vercel.app',
]

// Better Auth valida Origin/Referer contra esta lista en sign-in/sign-up
// (incluso sin cookies, desde 1.6.16). Los orígenes locales (localhost:3001,
// *.localhost de los tests multi-sesión) NO van aquí: se añaden en desarrollo
// con BETTER_AUTH_TRUSTED_ORIGINS, que Better Auth suma a esta lista por su
// cuenta.
const TRUSTED_ORIGINS = [...PRODUCTION_HOSTS, ...PREVIEW_HOST_PATTERNS].map(
  (host) => `https://${host}`,
)

// URL base de Better Auth según el entorno:
// - Preview de Vercel (VERCEL_ENV=preview): cada deployment tiene su propia
//   URL, así que una BETTER_AUTH_URL fija (compartida por todos los previews)
//   no sirve. Se resuelve por request desde el header Host, aceptando solo los
//   hosts de preview de este proyecto; cualquier otro host falla en vez de
//   caer en otra URL.
// - Producción: BETTER_AUTH_URL es obligatoria. Sin ella, callbacks y
//   redirects apuntarían a localhost en silencio, así que se aborta al arrancar.
// - Desarrollo: BETTER_AUTH_URL o localhost:3000.
function resolveBaseURL() {
  if (process.env.VERCEL_ENV === 'preview') {
    return { allowedHosts: PREVIEW_HOST_PATTERNS, protocol: 'https' as const }
  }

  const baseURL = process.env.BETTER_AUTH_URL
  if (baseURL) return baseURL

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BETTER_AUTH_URL is not set. It is required in production so auth callbacks and redirects do not fall back to localhost.',
    )
  }

  return 'http://localhost:3000'
}

// Configuración del servidor de autenticación con Better Auth + Drizzle (Postgres/Supabase)
export const auth = betterAuth({
  baseURL: resolveBaseURL(),
  trustedOrigins: TRUSTED_ORIGINS,
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
