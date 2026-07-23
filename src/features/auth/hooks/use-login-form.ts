import { useNavigate, useSearch } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
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

      await navigate({ to: getSafeRedirect(redirect) })
    },
  })

  // Validadores de campo exportados para reutilización en el componente
  const validators = {
    email: {
      onChange: ({ value }: { value: string }) => {
        const result = emailSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
    password: {
      onChange: ({ value }: { value: string }) => {
        const result = passwordSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
  }

  return { form, validators, serverError }
}
