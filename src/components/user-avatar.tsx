// Componente compartido de avatar de usuario.
// Fuente única para mostrar avatares en toda la app (header, miembros de guild,
// invitaciones, picker de settings). Resuelve el avatar estático elegido
// (avatarId -> catálogo) y cae al fallback de iniciales cuando no hay ninguno.
import type { ComponentProps } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { getUserInitials } from '#/lib/get-user-initials'
import { getAvatarSrc } from '#/features/user/avatar-catalog'
import { cn } from '#/lib/utils'

type UserAvatarProps = {
  // Nombre y email para calcular iniciales (fallback)
  name?: string | null
  email?: string | null
  // Imagen externa (p. ej. proveedor OAuth); fallback si no hay avatarId
  image?: string | null
  // Id del catálogo de avatares estáticos; tiene prioridad sobre `image`
  avatarId?: string | null
  // Iniciales ya calculadas (p. ej. miembros de guild sin nombre completo)
  initials?: string | null
  // Fuerza alt="" (decorativo) aunque haya name/email/initials — para listas
  // públicas que ocultan identidad a propósito (p. ej. preview de invitación)
  decorative?: boolean
  size?: ComponentProps<typeof Avatar>['size']
  className?: string
  // Clases extra para el fallback de iniciales (estilos por sitio de uso)
  fallbackClassName?: string
} & Omit<ComponentProps<typeof Avatar>, 'size' | 'className' | 'children'>

export function UserAvatar({
  name,
  email,
  image,
  avatarId,
  initials,
  decorative,
  size,
  className,
  fallbackClassName,
  ...props
}: UserAvatarProps) {
  // Prioridad: avatar estático del catálogo > imagen externa > iniciales
  const src = getAvatarSrc(avatarId) ?? image ?? undefined
  const fallback = initials?.trim() ? initials : getUserInitials(name, email)
  const displayName = decorative ? '' : (name ?? email ?? 'User')

  return (
    <Avatar size={size} className={className} {...props}>
      <AvatarImage src={src} alt={displayName} />
      <AvatarFallback className={cn(fallbackClassName)}>
        {fallback}
      </AvatarFallback>
    </Avatar>
  )
}
