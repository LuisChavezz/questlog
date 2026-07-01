import { useForm } from '@tanstack/react-form'

import { userNameSchema } from '../schemas/user-schemas'
import type { UpdateUserValues } from '../schemas/user-schemas'
import { useUpdateUser } from './use-update-user'

// Hook que encapsula la lógica del formulario de datos generales del usuario
export function useUpdateUserForm(currentName: string, onSuccess?: () => void) {
  const updateUser = useUpdateUser(onSuccess)

  const defaultValues: UpdateUserValues = {
    name: currentName,
  }

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      // El error queda capturado en updateUser.error; se evita propagar el
      // rechazo para no romper el flujo de submit del formulario.
      await updateUser.mutateAsync(value).catch(() => {})
    },
  })

  const validators = {
    name: {
      onChange: ({ value }: { value: string }) => {
        const result = userNameSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
  }

  const serverError = updateUser.error
    ? updateUser.error instanceof Error
      ? updateUser.error.message
      : 'Something went wrong. Please try again.'
    : null

  return { form, validators, serverError }
}
