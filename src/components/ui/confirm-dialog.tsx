/**
 * ConfirmDialog — wrapper genérico sobre el primitivo AlertDialog.
 * Expone una API controlada (open/onOpenChange) y soporta handlers de
 * confirmación asíncronos, deshabilitando los botones mientras se resuelven.
 * No contiene lógica de dominio — es reutilizable en cualquier flujo.
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
  onConfirm,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false)

  // Ejecuta onConfirm y cierra el diálogo al resolver, soportando promesas
  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Evitar el cierre automático de Radix hasta que la promesa se resuelva
    event.preventDefault()

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

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isConfirming}>
              {cancelLabel}
            </Button>
          </AlertDialogCancel>

          <AlertDialogAction asChild>
            <Button
              variant={variant}
              disabled={isConfirming}
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
