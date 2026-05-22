import { Bell } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { UserAvatarMenu } from './user-avatar-menu'

// Cabecera principal de la aplicación.
// Muestra las acciones globales del usuario en la parte derecha:
// botón de notificaciones y menú de avatar con logout.
export function AppHeader() {
  const { data: session } = authClient.useSession()
  const user = session?.user

  return (
    <header className="flex h-12 shrink-0 items-center justify-end gap-1 border-b border-border bg-background px-4">
      {/* Botón de notificaciones — funcionalidad pendiente */}
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
      </Button>

      {/* Menú de usuario: avatar + dropdown */}
      <UserAvatarMenu
        name={user?.name}
        email={user?.email}
        image={user?.image}
      />
    </header>
  )
}
