import { revalidateLogic, useForm } from '@tanstack/react-form'

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
    // Sin errores hasta el primer intento de envío; a partir de ahí cada
    // cambio revalida. Solo gobierna los validadores `onDynamic`.
    validationLogic: revalidateLogic(),
    // Cada envío vuelve a validar y muestra los errores vigentes; `onSubmit`
    // solo corre si todos los campos son válidos.
    canSubmitWhenInvalid: true,
    onSubmit: async ({ value }) => {
      try {
        await updateUser.mutateAsync(value)
      } catch {
        // El error queda capturado en updateUser.error; se evita propagar el
        // rechazo para no romper el flujo de submit del formulario.
        return
      }

      // Guardado: el formulario vuelve a la validación diferida hasta el
      // próximo envío. `keepDefaultValues` porque la sesión se refresca después
      // y sin esperarla: si el reset adoptara lo guardado como valor por
      // defecto, el siguiente render con el nombre viejo en las props lo
      // reescribiría en el input hasta que llegara la sesión nueva.
      form.reset(value, { keepDefaultValues: true })
    },
  })

  const validators = {
    name: {
      onDynamic: ({ value }: { value: string }) => {
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
