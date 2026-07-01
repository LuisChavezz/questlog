/**
 * Esquemas de validación para los campos del perfil de usuario.
 * Fuente única de verdad: se reutiliza en el formulario de Settings.
 */
import { z } from 'zod'

import { avatarIds } from '../avatar-catalog'

/** Nombre del usuario: obligatorio, máximo 100 caracteres */
export const userNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or fewer')

export const updateUserSchema = z.object({
  name: userNameSchema,
})

export type UpdateUserValues = z.infer<typeof updateUserSchema>

// Conjunto de ids válidos del catálogo para validar la selección en el servidor
const avatarIdSet = new Set(avatarIds)

/**
 * Avatar elegido: debe ser un id del catálogo estático, o `null` para limpiarlo
 * (volver al fallback de iniciales).
 */
export const avatarIdSchema = z
  .string()
  .nullable()
  .refine((value) => value === null || avatarIdSet.has(value), {
    message: 'Invalid avatar selection',
  })

export const updateUserAvatarSchema = z.object({
  avatarId: avatarIdSchema,
})

export type UpdateUserAvatarValues = z.infer<typeof updateUserAvatarSchema>
