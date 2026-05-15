import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'
import {
  emailSchema,
  nameSchema,
  registerPasswordSchema,
} from '../schemas/auth-schemas'

// Hook que encapsula la lógica del formulario de registro
export function useRegisterForm() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)

      const { error } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        name: value.name,
      })

      if (error) {
        setServerError(error.message ?? 'Could not create account. Please try again.')
        return
      }

      await navigate({ to: '/dashboard' })
    },
  })

  // Validadores de campo exportados para reutilización en el componente.
  // El validador de confirmPassword cierra sobre `form` para acceder
  // al valor actual de `password` sin necesidad de `fieldApi`.
  const validators = {
    name: {
      onChange: ({ value }: { value: string }) => {
        const result = nameSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
    email: {
      onChange: ({ value }: { value: string }) => {
        const result = emailSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
    password: {
      onChange: ({ value }: { value: string }) => {
        const result = registerPasswordSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
    confirmPassword: {
      onChange: ({ value }: { value: string }) => {
        if (!value) return 'Please confirm your password'
        if (value !== form.state.values.password) return "Passwords don't match"
        return undefined
      },
    },
  }

  return { form, validators, serverError }
}
