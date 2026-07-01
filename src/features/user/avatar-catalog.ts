/**
 * Catálogo de avatares estáticos — AUTO-GENERADO por scripts/build-avatars.ts.
 * No editar a mano: correr el script para regenerarlo.
 *
 * Cada entrada referencia una imagen WebP de 128x128 servida desde public/avatars.
 * El campo `id` es el valor persistido en `user.avatarId`.
 */

export type AvatarCatalogEntry = {
  id: string
  src: string
}

export const avatarCatalog: AvatarCatalogEntry[] = [
  { id: 'avatar-01', src: '/avatars/avatar-01.webp' },
  { id: 'avatar-02', src: '/avatars/avatar-02.webp' },
  { id: 'avatar-03', src: '/avatars/avatar-03.webp' },
  { id: 'avatar-04', src: '/avatars/avatar-04.webp' },
  { id: 'avatar-05', src: '/avatars/avatar-05.webp' },
  { id: 'avatar-06', src: '/avatars/avatar-06.webp' },
  { id: 'avatar-07', src: '/avatars/avatar-07.webp' },
  { id: 'avatar-08', src: '/avatars/avatar-08.webp' },
  { id: 'avatar-09', src: '/avatars/avatar-09.webp' },
  { id: 'avatar-10', src: '/avatars/avatar-10.webp' },
  { id: 'avatar-11', src: '/avatars/avatar-11.webp' },
  { id: 'avatar-12', src: '/avatars/avatar-12.webp' },
  { id: 'avatar-13', src: '/avatars/avatar-13.webp' },
  { id: 'avatar-14', src: '/avatars/avatar-14.webp' },
  { id: 'avatar-15', src: '/avatars/avatar-15.webp' },
  { id: 'avatar-16', src: '/avatars/avatar-16.webp' },
  { id: 'avatar-17', src: '/avatars/avatar-17.webp' },
  { id: 'avatar-18', src: '/avatars/avatar-18.webp' },
  { id: 'avatar-19', src: '/avatars/avatar-19.webp' },
  { id: 'avatar-20', src: '/avatars/avatar-20.webp' },
  { id: 'avatar-21', src: '/avatars/avatar-21.webp' },
  { id: 'avatar-22', src: '/avatars/avatar-22.webp' },
  { id: 'avatar-23', src: '/avatars/avatar-23.webp' },
  { id: 'avatar-24', src: '/avatars/avatar-24.webp' },
  { id: 'avatar-25', src: '/avatars/avatar-25.webp' },
  { id: 'avatar-26', src: '/avatars/avatar-26.webp' },
  { id: 'avatar-27', src: '/avatars/avatar-27.webp' },
  { id: 'avatar-28', src: '/avatars/avatar-28.webp' },
  { id: 'avatar-29', src: '/avatars/avatar-29.webp' },
  { id: 'avatar-30', src: '/avatars/avatar-30.webp' },
  { id: 'avatar-31', src: '/avatars/avatar-31.webp' },
  { id: 'avatar-32', src: '/avatars/avatar-32.webp' },
  { id: 'avatar-33', src: '/avatars/avatar-33.webp' },
  { id: 'avatar-34', src: '/avatars/avatar-34.webp' },
  { id: 'avatar-35', src: '/avatars/avatar-35.webp' },
  { id: 'avatar-36', src: '/avatars/avatar-36.webp' },
  { id: 'avatar-37', src: '/avatars/avatar-37.webp' },
  { id: 'avatar-38', src: '/avatars/avatar-38.webp' },
  { id: 'avatar-39', src: '/avatars/avatar-39.webp' },
  { id: 'avatar-40', src: '/avatars/avatar-40.webp' },
  { id: 'avatar-41', src: '/avatars/avatar-41.webp' },
  { id: 'avatar-42', src: '/avatars/avatar-42.webp' },
  { id: 'avatar-43', src: '/avatars/avatar-43.webp' },
  { id: 'avatar-44', src: '/avatars/avatar-44.webp' },
  { id: 'avatar-45', src: '/avatars/avatar-45.webp' },
  { id: 'avatar-46', src: '/avatars/avatar-46.webp' },
  { id: 'avatar-47', src: '/avatars/avatar-47.webp' },
  { id: 'avatar-48', src: '/avatars/avatar-48.webp' },
  { id: 'avatar-49', src: '/avatars/avatar-49.webp' },
  { id: 'avatar-50', src: '/avatars/avatar-50.webp' },
]

// Índice id -> src para resolver rápidamente el avatar elegido por el usuario
const avatarSrcById = new Map(avatarCatalog.map((a) => [a.id, a.src]))

/** Conjunto de ids válidos, reutilizable por la validación del servidor. */
export const avatarIds = avatarCatalog.map((a) => a.id)

/**
 * Devuelve la ruta pública del avatar con `id`, o `null` si el id no existe
 * (incluye el caso `null`/`undefined` de un usuario sin avatar elegido).
 */
export function getAvatarSrc(id: string | null | undefined): string | null {
  if (!id) return null
  return avatarSrcById.get(id) ?? null
}
