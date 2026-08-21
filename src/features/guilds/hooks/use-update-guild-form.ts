// Hook que encapsula la lógica del formulario de perfil del guild — mismo
// reparto que useCreateGuildForm: validación por campo con los esquemas de Zod
// y la mutación acá, el UI aparte (guild-profile-form.tsx).
import { useForm } from '@tanstack/react-form'

import {
  editableGuildDescriptionSchema,
  guildNameSchema,
} from '../schemas/guild-schemas'
import type { GuildProfileFormValues } from '../schemas/guild-schemas'
import { useUpdateGuild } from './use-update-guild'

export function useUpdateGuildForm(
  slug: string,
  currentName: string,
  currentDescription: string | null,
) {
  const updateGuild = useUpdateGuild(slug)

  // Valores actuales del guild normalizados a lo que muestra el formulario: la
  // descripción ausente (NULL en la BD) se edita como cadena vacía. Sirve de
  // doble propósito: son los `defaultValues` y la referencia contra la que se
  // decide si hay cambios sin guardar.
  const currentValues: GuildProfileFormValues = {
    name: currentName,
    description: currentDescription ?? '',
  }

  const form = useForm({
    defaultValues: currentValues,
    onSubmit: async ({ value }) => {
      // El error queda capturado en updateGuild.error; se evita propagar el
      // rechazo para no romper el flujo de submit del formulario.
      await updateGuild.mutateAsync(value).catch(() => {})
    },
  })

  // Validadores de campo reutilizando los esquemas de Zod
  const validators = {
    name: {
      onChange: ({ value }: { value: string }) => {
        const result = guildNameSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
    description: {
      onChange: ({ value }: { value: string }) => {
        const result = editableGuildDescriptionSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
  }

  // Compara contra los valores actuales del guild, no contra el estado "dirty"
  // de TanStack Form: escribir algo y deshacerlo a mano deja el formulario
  // tocado pero sin nada que guardar, y el botón debe volver a apagarse.
  //
  // Ambos lados se recortan porque lo que el servidor persiste es la SALIDA de
  // los esquemas, y esos recortan (ver guildNameSchema). Comparando en crudo, un
  // espacio al final del nombre sobrevivía al guardado: el servidor almacenaba
  // el valor recortado, el refetch lo devolvía recortado y el formulario —que no
  // se remonta, su `key` es el id del guild— seguía con el espacio, así que el
  // botón no se apagaba nunca y la confirmación no llegaba a aparecer pese a que
  // el guardado había funcionado. El lado del guild también se recorta porque
  // las descripciones creadas antes de esta feature no pasaron por ningún trim.
  const hasChanges = (values: GuildProfileFormValues) =>
    values.name.trim() !== currentValues.name.trim() ||
    values.description.trim() !== currentValues.description.trim()

  // Escribe un campo y retira la confirmación de guardado. `isSuccess` es
  // pegajoso —queda en true hasta el próximo envío—, así que sin este reset
  // deshacer una edición a mano hacía reaparecer un "saved" que no correspondía
  // a ningún guardado nuevo.
  const handleFieldChange = (
    field: keyof GuildProfileFormValues,
    value: string,
  ) => {
    if (updateGuild.isSuccess) {
      updateGuild.reset()
    }

    form.setFieldValue(field, value)
  }

  // Error del servidor expuesto por la mutación para mostrarlo en el formulario
  const serverError = updateGuild.error
    ? updateGuild.error instanceof Error
      ? updateGuild.error.message
      : 'Something went wrong. Please try again.'
    : null

  return {
    form,
    validators,
    hasChanges,
    handleFieldChange,
    serverError,
    isSaved: updateGuild.isSuccess,
  }
}
