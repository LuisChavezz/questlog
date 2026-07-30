/**
 * ConfirmDialog — wrapper genérico sobre el primitivo AlertDialog.
 * Expone una API controlada (open/onOpenChange) y soporta handlers de
 * confirmación asíncronos, deshabilitando los botones mientras se resuelven.
 * No contiene lógica de dominio — es reutilizable en cualquier flujo.
 *
 * Para acciones irreversibles admite además confirmación TECLEADA
 * (`confirmationPhrase`): el botón de confirmar queda deshabilitado hasta que el
 * usuario escribe esa frase exacta, al estilo del borrado de repositorios de
 * GitHub. Es un opt-in: sin esa prop el diálogo se comporta como siempre.
 */
import * as React from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

type ConfirmDialogVariant = 'default' | 'destructive'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Variante del botón de confirmación — usar 'destructive' para acciones peligrosas */
  variant?: ConfirmDialogVariant
  /**
   * Frase exacta que el usuario debe teclear para habilitar la confirmación.
   * Al pasarla, el diálogo muestra un campo de texto y mantiene el botón de
   * confirmar deshabilitado hasta que coincida. Omitirla = confirmación directa.
   */
  confirmationPhrase?: string
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  confirmationPhrase,
  onConfirm,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false)
  const [confirmationText, setConfirmationText] = React.useState('')
  const confirmationInputId = React.useId()

  // Cada apertura (y cada cierre) parte de un campo vacío: si no, reabrir el
  // diálogo mostraría el botón ya habilitado con lo tecleado la vez anterior.
  React.useEffect(() => {
    setConfirmationText('')
  }, [open])

  // Comparación sensible a mayúsculas, con los espacios de los extremos
  // recortados en ambos lados — mismo criterio que la confirmación tecleada del
  // diálogo de transferencia de propiedad de guild.
  const requiresTypedConfirmation = confirmationPhrase !== undefined
  const expectedPhrase = confirmationPhrase?.trim() ?? ''
  // Una frase en blanco (solo espacios) haría que un campo vacío "coincidiera"
  // sin teclear nada: se bloquea la confirmación por completo en vez de permitir
  // ese atajo no intencional.
  const matchesPhrase =
    expectedPhrase !== '' && confirmationText.trim() === expectedPhrase
  const canConfirm = !requiresTypedConfirmation || matchesPhrase

  // Ejecuta onConfirm y cierra el diálogo al resolver, soportando promesas
  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Evitar el cierre automático de Radix hasta que la promesa se resuelva
    event.preventDefault()

    // Red de seguridad: el botón ya va deshabilitado sin la frase tecleada, pero
    // la acción puede ser irreversible — no se dispara sin la puerta abierta.
    if (!canConfirm) return

    try {
      setIsConfirming(true)
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        {requiresTypedConfirmation && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor={confirmationInputId}
              className="text-sm font-medium text-foreground"
            >
              Type <span className="font-semibold">{confirmationPhrase}</span>{' '}
              to confirm
            </label>
            <Input
              id={confirmationInputId}
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder={confirmationPhrase}
              autoComplete="off"
              disabled={isConfirming}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isConfirming}>
              {cancelLabel}
            </Button>
          </AlertDialogCancel>

          <AlertDialogAction asChild>
            <Button
              variant={variant}
              disabled={isConfirming || !canConfirm}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
