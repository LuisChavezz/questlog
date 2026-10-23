import { useNavigate, useSearch } from '@tanstack/react-router'
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'
import {
  emailSchema,
  getSafeRedirect,
  passwordSchema,
} from '../schemas/auth-schemas'

// Hook que encapsula la lógica del formulario de inicio de sesión
export function useLoginForm() {
  const navigate = useNavigate()
  // Destino tras iniciar sesión: el `redirect` de la URL o quests por defecto
  const { redirect } = useSearch({ strict: false })
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    // Sin errores hasta el primer intento de envío; a partir de ahí cada
    // cambio revalida. Solo gobierna los validadores `onDynamic`.
    validationLogic: revalidateLogic(),
    // Cada envío vuelve a validar y muestra los errores vigentes; `onSubmit`
    // solo corre si todos los campos son válidos.
    canSubmitWhenInvalid: true,
    onSubmit: async ({ value }) => {
      setServerError(null)

      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      })

      if (error) {
        setServerError(
          error.message ?? 'Invalid credentials. Please try again.',
        )
        return
      }

      // `href` (no `to`) para que el search del deep link llegue intacto:
      // getSafeRedirect garantiza que es una ruta interna, nunca una URL.
      await navigate({ href: getSafeRedirect(redirect) })
    },
  })

  // Validadores de campo exportados para reutilización en el componente
  const validators = {
    email: {
      onDynamic: ({ value }: { value: string }) => {
        const result = emailSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
    password: {
      onDynamic: ({ value }: { value: string }) => {
        const result = passwordSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
  }

  return { form, validators, serverError }
}
