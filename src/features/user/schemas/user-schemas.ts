/**
 * Esquemas de validación para los campos del perfil de usuario.
 * Fuente única de verdad: se reutiliza en el formulario de Settings.
 */
import { z } from 'zod'

/** Nombre del usuario: obligatorio, máximo 100 caracteres */
export const userNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or fewer')

export const updateUserSchema = z.object({
  name: userNameSchema,
})

export type UpdateUserValues = z.infer<typeof updateUserSchema>
