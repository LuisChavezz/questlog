import { useNavigate, useSearch } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'
import {
  submitGatedFormOptions,
  zodFieldValidator,
} from '#/lib/form-validation'
import {
  emailSchema,
  getSafeRedirect,
  nameSchema,
  registerPasswordSchema,
} from '../schemas/auth-schemas'

// Hook que encapsula la lógica del formulario de registro
export function useRegisterForm() {
  const navigate = useNavigate()
  // Destino tras registrarse: el `redirect` de la URL o quests por defecto
  const { redirect } = useSearch({ strict: false })
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    ...submitGatedFormOptions,
    onSubmit: async ({ value }) => {
      setServerError(null)

      const { error } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        name: value.name,
      })

      if (error) {
        setServerError(
          error.message ?? 'Could not create account. Please try again.',
        )
        return
      }

      // `href` (no `to`) para que el search del deep link llegue intacto:
      // getSafeRedirect garantiza que es una ruta interna, nunca una URL.
      await navigate({ href: getSafeRedirect(redirect) })
    },
  })

  // Validadores de campo exportados para reutilización en el componente.
  // El validador de confirmPassword cierra sobre `form` para acceder
  // al valor actual de `password` sin necesidad de `fieldApi`.
  const validators = {
    name: {
      onDynamic: zodFieldValidator(nameSchema),
    },
    email: {
      onDynamic: zodFieldValidator(emailSchema),
    },
    password: {
      onDynamic: zodFieldValidator(registerPasswordSchema),
    },
    confirmPassword: {
      onDynamic: ({ value }: { value: string }) => {
        if (!value) return 'Please confirm your password'
        if (value !== form.state.values.password) return "Passwords don't match"
        return undefined
      },
    },
  }

  return { form, validators, serverError }
}
