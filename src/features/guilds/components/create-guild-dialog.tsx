/**
 * CreateGuildDialog — modal controlado que aloja el formulario de creación.
 * El estado de apertura lo gestiona el componente padre (open/onOpenChange).
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

import { CreateGuildForm } from './create-guild-form'

type CreateGuildDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateGuildDialog({
  open,
  onOpenChange,
}: CreateGuildDialogProps) {
  // Cierra el modal (tras crear o al cancelar)
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Guild</DialogTitle>
          <DialogDescription>
            Create a guild to start collaborating with your team on quests.
          </DialogDescription>
        </DialogHeader>

        <CreateGuildForm onSuccess={close} onCancel={close} />
      </DialogContent>
    </Dialog>
  )
}
