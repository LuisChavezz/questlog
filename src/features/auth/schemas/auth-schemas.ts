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

/**
 * Devuelve un destino de redirección seguro. Solo se permiten rutas internas
 * que empiezan con "/" (y no "//", que el navegador interpreta como URL
 * protocol-relative). Así se evita un open-redirect hacia dominios externos.
 */
export function getSafeRedirect(redirect: string | undefined): string {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect
  }
  return '/dashboard'
}
