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

// ─── Esquema de consulta por slug ─────────────────────────────────────────────

/** Esquema de entrada para obtener el detalle de un guild por slug */
export const getGuildInputSchema = z.object({
  slug: guildSlugSchema,
})

// ─── Esquema del historial de actividad (paginado) ────────────────────────────

/**
 * Entrada del historial de actividad de un guild. `page` es 0-based; el tamaño
 * de página lo fija el servidor (`GUILD_ACTIVITY_PAGE_SIZE`). El detalle reciente
 * (tarjeta, top 5) reutiliza `getGuildInputSchema` porque solo necesita el slug.
 */
export const getGuildActivityHistorySchema = z.object({
  slug: guildSlugSchema,
  page: z.number().int().min(0),
})

export type GetGuildActivityHistoryValues = z.infer<
  typeof getGuildActivityHistorySchema
>

// ─── Esquema de regeneración de invite code ───────────────────────────────────

/** Esquema de entrada para regenerar el invite code de un guild */
export const regenerateInviteCodeSchema = z.object({
  guildId: z.string().min(1),
})

// ─── Esquema de regeneración de escudo de armas ───────────────────────────────

/** Esquema de entrada para regenerar (o generar por primera vez) el escudo de armas de un guild */
export const regenerateCoatOfArmsSchema = z.object({
  slug: guildSlugSchema,
})

export type RegenerateCoatOfArmsValues = z.infer<
  typeof regenerateCoatOfArmsSchema
>

// ─── Esquemas de invitación (preview público + unirse) ─────────────────────────

/** Código de invitación: cadena no vacía. La validez real se verifica en la DB. */
export const inviteCodeSchema = z.string().min(1, 'Invite code is required')

/** Construye la URL de invitación a partir del código, evitando rutas hardcodeadas duplicadas. */
export function getInviteUrl(code: string, origin = '') {
  return `${origin}/invite/${code}`
}

/** Esquema de entrada para previsualizar una invitación por su código */
export const getGuildInvitePreviewSchema = z.object({
  code: inviteCodeSchema,
})

/** Esquema de entrada para unirse a un guild mediante su código de invitación */
export const joinGuildSchema = z.object({
  code: inviteCodeSchema,
})

// ─── Esquemas de gestión de miembros ──────────────────────────────────────────

/**
 * Roles asignables vía la acción de cambio de rol. El rol `owner` es estructural
 * (ligado a `guilds.owner_id`) y nunca se asigna por este flujo, por lo que se
 * excluye deliberadamente del enum.
 */
export const assignableGuildRoleSchema = z.enum(['member', 'admin'])

export type AssignableGuildRole = z.infer<typeof assignableGuildRoleSchema>

/** Esquema de entrada para cambiar el rol de un miembro dentro de un guild */
export const updateGuildMemberRoleSchema = z.object({
  slug: guildSlugSchema,
  userId: z.string().min(1),
  newRole: assignableGuildRoleSchema,
})

export type UpdateGuildMemberRoleValues = z.infer<
  typeof updateGuildMemberRoleSchema
>

/** Esquema de entrada para expulsar a un miembro de un guild */
export const removeGuildMemberSchema = z.object({
  slug: guildSlugSchema,
  userId: z.string().min(1),
})

export type RemoveGuildMemberValues = z.infer<typeof removeGuildMemberSchema>

/** Esquema de entrada para transferir la propiedad de un guild a otro miembro */
export const transferGuildOwnershipSchema = z.object({
  slug: guildSlugSchema,
  newOwnerUserId: z.string().min(1),
})

export type TransferGuildOwnershipValues = z.infer<
  typeof transferGuildOwnershipSchema
>

/** Esquema de entrada para abandonar un guild voluntariamente */
export const leaveGuildSchema = z.object({
  slug: guildSlugSchema,
})

export type LeaveGuildValues = z.infer<typeof leaveGuildSchema>
