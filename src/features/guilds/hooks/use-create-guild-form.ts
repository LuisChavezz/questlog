import { useState } from 'react'
import { useForm } from '@tanstack/react-form'

import {
  submitGatedFormOptions,
  zodFieldValidator,
} from '#/lib/form-validation'
import {
  guildDescriptionSchema,
  guildNameSchema,
  guildSlugSchema,
  slugifyGuildName,
} from '../schemas/guild-schemas'
import type { CreateGuildValues } from '../schemas/guild-schemas'
import { useCreateGuild } from './use-create-guild'

// Hook que encapsula la lógica del formulario de creación de guilds
export function useCreateGuildForm(onSuccess?: () => void) {
  // Indica si el usuario editó el slug manualmente; mientras sea false
  // el slug se deriva automáticamente del nombre.
  const [slugEdited, setSlugEdited] = useState(false)

  // Mutación: al crear el guild se resetea el formulario y se cierra el modal.
  // `form` se referencia dentro de un closure diferido, por lo que ya existe
  // cuando esta callback se ejecuta tras el éxito de la mutación.
  const createGuild = useCreateGuild(() => {
    form.reset()
    setSlugEdited(false)
    onSuccess?.()
  })

  const defaultValues: CreateGuildValues = {
    name: '',
    slug: '',
    description: undefined,
  }

  const form = useForm({
    defaultValues,
    ...submitGatedFormOptions,
    onSubmit: async ({ value }) => {
      // El error queda capturado en createGuild.error; se evita propagar el
      // rechazo para no romper el flujo de submit del formulario.
      await createGuild.mutateAsync(value).catch(() => {})
    },
  })

  // Actualiza el nombre y deriva el slug salvo que el usuario lo haya editado.
  // setFieldValue marca el campo como tocado y lo valida (con revalidateLogic,
  // solo tiene efecto visible después del primer intento de envío).
  const handleNameChange = (value: string) => {
    form.setFieldValue('name', value)

    if (!slugEdited) {
      form.setFieldValue('slug', slugifyGuildName(value))
    }
  }

  // Marca el slug como override manual y lo normaliza al formato válido.
  const handleSlugChange = (value: string) => {
    if (!slugEdited) {
      setSlugEdited(true)
    }

    form.setFieldValue('slug', slugifyGuildName(value))
  }

  // Validadores de campo reutilizando los esquemas de Zod
  const validators = {
    name: {
      onDynamic: zodFieldValidator(guildNameSchema),
    },
    slug: {
      onDynamic: zodFieldValidator(guildSlugSchema),
    },
    description: {
      onDynamic: zodFieldValidator(guildDescriptionSchema),
    },
  }

  // Error del servidor expuesto por la mutación para mostrarlo en el formulario
  const serverError = createGuild.error
    ? createGuild.error instanceof Error
      ? createGuild.error.message
      : 'Something went wrong. Please try again.'
    : null

  return { form, validators, serverError, handleNameChange, handleSlugChange }
}
