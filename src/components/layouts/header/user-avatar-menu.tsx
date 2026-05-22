import { LogOut, Settings } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { useLogout } from '#/features/auth/hooks/use-logout'
import { getUserInitials } from './get-user-initials'

interface UserAvatarMenuProps {
  // Nombre completo o email del usuario — usado para iniciales y label
  name?: string | null
  email?: string | null
  image?: string | null
}

// Botón de avatar con menú desplegable: Settings y Logout
export function UserAvatarMenu({ name, email, image }: UserAvatarMenuProps) {
  const { logout, isPending } = useLogout()
  const initials = getUserInitials(name, email)
  const displayName = name ?? email ?? 'User'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open user menu"
        >
          <Avatar className="size-8">
            {image && (
              <AvatarImage src={image} alt={displayName} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        {/* Etiqueta con info del usuario */}
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground truncate">
            {displayName}
          </span>
          {email && (
            <span className="text-xs font-normal text-muted-foreground truncate">
              {email}
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Opción Settings (sin funcionalidad por ahora) */}
        <DropdownMenuItem disabled>
          <Settings />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Opción Logout — integrada con Better Auth */}
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            void logout()
          }}
          disabled={isPending}
          aria-busy={isPending}
        >
          <LogOut />
          {isPending ? 'Signing out…' : 'Log out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
