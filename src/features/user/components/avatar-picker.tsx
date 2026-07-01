// AvatarPicker — trigger con el avatar actual + dialog con la grilla del catálogo.
// Al elegir un avatar dispara la mutación optimista y solo cierra el dialog
// si termina bien; si falla, se queda abierto mostrando el error inline.
import { Ban } from 'lucide-react'
import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { UserAvatar } from '#/components/user-avatar'
import { cn } from '#/lib/utils'

import { avatarCatalog } from '../avatar-catalog'
import { useUpdateUserAvatar } from '../hooks/use-update-user-avatar'

type AvatarPickerProps = {
  // Avatar elegido actualmente (null = iniciales)
  currentAvatarId: string | null
  // Datos para el fallback de iniciales del trigger
  name: string | null
  email: string | null
  image: string | null
}

export function AvatarPicker({
  currentAvatarId,
  name,
  email,
  image,
}: AvatarPickerProps) {
  const [open, setOpen] = useState(false)
  // Cerrar el dialog solo cuando la mutación termina bien; si falla, se
  // queda abierto para mostrar el error inline (ver serverError abajo)
  const updateAvatar = useUpdateUserAvatar(() => setOpen(false))

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      // Limpiar el error de un intento anterior al reabrir el picker
      updateAvatar.reset()
    }
  }

  function handleSelect(avatarId: string | null) {
    if (avatarId === currentAvatarId) {
      setOpen(false)
      return
    }
    updateAvatar.mutate(avatarId)
  }

  const serverError = updateAvatar.error
    ? updateAvatar.error instanceof Error
      ? updateAvatar.error.message
      : 'Something went wrong. Please try again.'
    : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Change avatar"
        >
          <UserAvatar
            name={name}
            email={email}
            image={image}
            avatarId={currentAvatarId}
            size="lg"
            className="size-16"
            fallbackClassName="bg-primary/10 text-primary text-base font-semibold"
          />
          {/* Overlay "Edit" al pasar el cursor */}
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Edit
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose your avatar</DialogTitle>
          <DialogDescription>
            Pick a character portrait to represent you across Questlog.
          </DialogDescription>
        </DialogHeader>

        {/* Grilla responsiva y scrollable de todos los avatares del catálogo.
            El padding va en el contenedor con scroll para que el hover de los
            avatares del borde no se recorte y quede aire respecto a la barra. */}
        <div className="max-h-[60vh] overflow-y-auto p-2 pr-3">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {/* Tile "None": vuelve a las iniciales, mismo flujo que un avatar real */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              disabled={updateAvatar.isPending}
              aria-pressed={currentAvatarId === null}
              aria-label="Use initials (no avatar)"
              className={cn(
                'relative aspect-square w-full rounded-full ring-2 ring-offset-2 ring-offset-background transition focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed',
                currentAvatarId === null
                  ? 'ring-primary'
                  : 'ring-transparent hover:ring-border',
                updateAvatar.isPending &&
                  updateAvatar.variables === null &&
                  'animate-pulse opacity-50',
              )}
            >
              <UserAvatar
                name={name}
                email={email}
                className="size-full"
                fallbackClassName="bg-muted text-muted-foreground text-xs font-semibold"
              />
              <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2 border-background bg-muted-foreground text-background">
                <Ban className="size-3" aria-hidden="true" />
              </span>
            </button>

            {avatarCatalog.map((entry) => {
              const isSelected = entry.id === currentAvatarId
              const isPending =
                updateAvatar.isPending && updateAvatar.variables === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleSelect(entry.id)}
                  disabled={updateAvatar.isPending}
                  aria-pressed={isSelected}
                  aria-label={`Select ${entry.id}`}
                  className={cn(
                    'aspect-square w-full rounded-full ring-2 ring-offset-2 ring-offset-background transition focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed',
                    isSelected
                      ? 'ring-primary'
                      : 'ring-transparent hover:ring-border',
                    isPending && 'animate-pulse opacity-50',
                  )}
                >
                  <UserAvatar avatarId={entry.id} className="size-full" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Error de servidor: se queda visible hasta que el usuario reintente
            o reabra el picker (mismo tratamiento que settings-general-section) */}
        {serverError && (
          <p className="text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
