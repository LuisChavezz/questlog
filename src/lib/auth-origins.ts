// Resolución de la URL base y de los orígenes de confianza de Better Auth según
// el entorno. Son funciones puras sobre un objeto de entorno (en producción,
// `process.env`) para poder probar cada caso sin levantar Better Auth ni la base
// de datos.
//
// Better Auth valida Origin/Referer contra `trustedOrigins` en sign-in/sign-up
// (incluso sin cookies, desde 1.6.16), así que esta lista decide desde dónde se
// puede iniciar sesión. Nunca se usan patrones ni comodines, ni se deriva nada
// del header Host de la request: solo URLs exactas.

export type AuthOriginsEnv = {
  NODE_ENV?: string
  VERCEL_ENV?: string
  VERCEL_URL?: string
  VERCEL_BRANCH_URL?: string
  BETTER_AUTH_URL?: string
}

export type AuthOrigins = {
  baseURL: string
  trustedOrigins: string[]
}

// Dominios de producción del proyecto en Vercel. Lista explícita porque
// VERCEL_PROJECT_PRODUCTION_URL solo expone uno de ellos (el más corto).
export const PRODUCTION_ORIGINS = [
  'https://questlog-neon.vercel.app',
  'https://questlog-neon-ten.vercel.app',
  'https://questlog-luis-alberto-ceja-chavezs-projects.vercel.app',
]

const DEVELOPMENT_BASE_URL = 'http://localhost:3000'

export function resolveAuthOrigins(env: AuthOriginsEnv): AuthOrigins {
  // Preview de Vercel: se confía solo en las URLs de ESTE deployment, que
  // Vercel inyecta por deployment (sin esquema). BETTER_AUTH_URL se ignora a
  // propósito: es un único valor compartido por todos los previews, así que no
  // puede coincidir con la URL de cada uno.
  if (env.VERCEL_ENV === 'preview') {
    const previewOrigins = [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
      .filter((host): host is string => Boolean(host))
      .map((host) => `https://${host}`)

    if (previewOrigins.length === 0) {
      throw new Error(
        'VERCEL_URL is not set. Preview deployments need it to resolve the auth base URL.',
      )
    }

    return { baseURL: previewOrigins[0], trustedOrigins: previewOrigins }
  }

  // Producción: BETTER_AUTH_URL es obligatoria. Sin ella, callbacks y
  // redirects apuntarían a localhost en silencio, así que se aborta al arrancar.
  if (env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production') {
    if (!env.BETTER_AUTH_URL) {
      throw new Error(
        'BETTER_AUTH_URL is not set. It is required in production so auth callbacks and redirects do not fall back to localhost.',
      )
    }

    return { baseURL: env.BETTER_AUTH_URL, trustedOrigins: PRODUCTION_ORIGINS }
  }

  // Desarrollo: BETTER_AUTH_URL o localhost. Los orígenes locales extra
  // (localhost:3001, *.localhost de los tests multi-sesión) llegan por
  // BETTER_AUTH_TRUSTED_ORIGINS, que Better Auth suma por su cuenta.
  return {
    baseURL: env.BETTER_AUTH_URL ?? DEVELOPMENT_BASE_URL,
    trustedOrigins: [],
  }
}
