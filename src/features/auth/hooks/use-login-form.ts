import { useForm } from '@tanstack/react-form'

import { emailSchema, passwordSchema } from '../schemas/auth-schemas'

// Hook que encapsula la lógica del formulario de inicio de sesión
export function useLoginForm() {
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      // TODO: integrar con el backend de autenticación
      console.log('Login submitted:', value)
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

  return { form, validators }
}
