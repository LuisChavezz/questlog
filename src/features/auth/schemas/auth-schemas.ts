import { z } from 'zod'

// Esquemas de campo reutilizables en validadores individuales
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name is too long')

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')

export const passwordSchema = z.string().min(1, 'Password is required')

export const registerPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')

// Esquemas completos para validación del formulario
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: registerPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>

// ─── Redirección post-autenticación ────────────────────────────────────────

/**
 * Search params de las rutas de auth. `redirect` permite volver a la URL de
 * origen tras iniciar sesión o registrarse (p. ej. una invitación a un guild).
 * `.catch(undefined)` evita que un valor malformado rompa la navegación.
 */
export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})

export type AuthSearch = z.infer<typeof authSearchSchema>

// Destino por defecto cuando no hay `redirect` o no es seguro
const DEFAULT_REDIRECT = '/quests'

// Origen ficticio contra el que se resuelve el destino para comprobar que una
// ruta "interna" no acaba apuntando a otro host. `.invalid` está reservado y
// nunca resuelve, así que no puede coincidir con un origen real.
const REDIRECT_CHECK_ORIGIN = 'http://questlog.invalid'

// Barras invertidas y caracteres de control: el navegador normaliza "\" a "/"
// y descarta tabuladores y saltos de línea al parsear una URL, así que
// "/\evil.com" o "/\t/evil.com" acaban siendo "//evil.com" (protocol-relative).
function hasUnsafeRedirectChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (char === '\\' || code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Devuelve un destino de redirección seguro. Solo se permiten rutas internas
 * (path + search + hash) cuyo path empieza con una única "/". Sobre el PATH —
 * en crudo y tras decodificarlo una vez, para cubrir "%5C" o "%2F%2F"— se
 * rechazan "//" (URL protocol-relative), barras invertidas y caracteres de
 * control: es la única parte que el navegador puede reinterpretar como otro
 * host. El search y el hash no se inspeccionan así, porque un valor como
 * "?q=C%5Cpath" es un deep link legítimo. Como última red, el destino COMPLETO
 * se resuelve contra un origen ficticio y debe seguir en él (eso descarta
 * además las URLs absolutas). Así se evita un open-redirect hacia dominios
 * externos.
 */
export function getSafeRedirect(redirect: string | undefined): string {
  if (!redirect) return DEFAULT_REDIRECT

  // Path = todo lo anterior al primer "?" o "#"
  const pathEnd = redirect.search(/[?#]/)
  const path = pathEnd === -1 ? redirect : redirect.slice(0, pathEnd)

  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(path)
  } catch {
    // Secuencia de escape malformada: no se intenta adivinar qué quería decir
    return DEFAULT_REDIRECT
  }

  for (const candidate of [path, decodedPath]) {
    if (
      !candidate.startsWith('/') ||
      candidate.startsWith('//') ||
      hasUnsafeRedirectChars(candidate)
    ) {
      return DEFAULT_REDIRECT
    }
  }

  try {
    if (
      new URL(redirect, REDIRECT_CHECK_ORIGIN).origin !== REDIRECT_CHECK_ORIGIN
    ) {
      return DEFAULT_REDIRECT
    }
  } catch {
    return DEFAULT_REDIRECT
  }

  return redirect
}
