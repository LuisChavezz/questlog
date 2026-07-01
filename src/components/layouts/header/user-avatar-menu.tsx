import { LogOut, Settings } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { UserAvatar } from '#/components/user-avatar'
import { useLogout } from '#/features/auth/hooks/use-logout'
import { SettingsDialog } from '#/features/user/components/settings-dialog'

interface UserAvatarMenuProps {
  // Nombre completo o email del usuario — usado para iniciales y label
  name?: string | null
  email?: string | null
  image?: string | null
  // Avatar estático elegido del catálogo (null = iniciales)
  avatarId?: string | null
}

// Botón de avatar con menú desplegable: Settings y Logout
export function UserAvatarMenu({
  name,
  email,
  image,
  avatarId,
}: UserAvatarMenuProps) {
  const { logout, isPending } = useLogout()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const displayName = name ?? email ?? 'User'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open user menu"
          >
            <UserAvatar
              name={name}
              email={email}
              image={image}
              avatarId={avatarId}
              className="size-8"
              fallbackClassName="bg-primary/10 text-primary text-xs font-semibold"
            />
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

          {/* Opción Settings: abre el dialog de configuración */}
          <DropdownMenuItem
            onSelect={() => {
              setSettingsOpen(true)
            }}
          >
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

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentName={name ?? ''}
        currentEmail={email ?? null}
        currentImage={image ?? null}
        currentAvatarId={avatarId ?? null}
      />
    </>
  )
}
