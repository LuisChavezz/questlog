/**
 * Esquemas de validación y utilidades para los campos de un guild.
 * Fuente única de verdad: se reutilizan en el formulario de creación
 * (validadores por campo) y en el `inputValidator` del servidor.
 */
import { z } from 'zod'

// ─── Slugify ───────────────────────────────────────────────────────────────────

/**
 * Normaliza un texto a un slug apto para URLs: minúsculas, espacios a guiones,
 * sin caracteres especiales y sin guiones consecutivos.
 * Se usa para derivar el slug del nombre y para normalizar la edición manual.
 */
export function slugifyGuildName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // quitar caracteres no permitidos
    .replace(/\s+/g, '-') // espacios → guiones
    .replace(/-+/g, '-') // colapsar guiones consecutivos
}

// ─── Esquemas de campos reutilizables ─────────────────────────────────────────

/** Nombre del guild: obligatorio, máximo 100 caracteres */
export const guildNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or fewer')

/**
 * Slug del guild: obligatorio, máximo 60 caracteres.
 * Solo permite minúsculas, números y guiones para mantener URLs limpias.
 */
export const guildSlugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(60, 'Slug must be 60 characters or fewer')
  .regex(
    /^[a-z0-9-]+$/,
    'Slug can only contain lowercase letters, numbers, and hyphens',
  )

/** Descripción opcional: máximo 500 caracteres */
export const guildDescriptionSchema = z
  .string()
  .max(500, 'Description must be 500 characters or fewer')
  .optional()

// ─── Esquema de creación ───────────────────────────────────────────────────────

/**
 * Esquema para crear un guild.
 * El `ownerId` y la membresía del dueño se resuelven en el servidor.
 */
export const createGuildSchema = z.object({
  name: guildNameSchema,
  slug: guildSlugSchema,
  description: guildDescriptionSchema,
})

export type CreateGuildValues = z.infer<typeof createGuildSchema>
