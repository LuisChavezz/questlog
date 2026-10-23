import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'

import {
  submitGatedFormOptions,
  zodFieldValidator,
} from '#/lib/form-validation'
import { createQuest } from '../api/create-quest'
import {
  questTitleSchema,
  questDescriptionSchema,
  questPrioritySchema,
  questDueDateSchema,
  getTodayDateString,
} from '../schemas/quest-schemas'
import type { CreateQuestValues } from '../schemas/quest-schemas'

// Contexto de guild opcional. Ausente = quest personal (sin asignado/supervisor
// y refrescando la lista personal). Presente = quest de guild: aporta el guildId
// que se envía al servidor y el slug con el que se invalidan las queries del
// guild (lista + detalle de Overview).
interface CreateQuestFormGuild {
  guildId: string
  slug: string
}

interface UseCreateQuestFormArgs {
  guild?: CreateQuestFormGuild
  onSuccess?: () => void
}

// Hook que encapsula la lógica del formulario de creación de quests, personal o
// de guild. La única diferencia entre ambos casos son los valores por defecto de
// los campos de guild y las queries que se invalidan al crear; el resto de la
// lógica (campos, validadores, manejo de envío) es idéntica, por eso vive aquí.
export function useCreateQuestForm({
  guild,
  onSuccess,
}: UseCreateQuestFormArgs = {}) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const minDueDate = getTodayDateString()

  const defaultValues: CreateQuestValues = {
    title: '',
    description: undefined,
    priority: 'medium',
    tags: undefined,
    dueDate: undefined,
    // Solo en contexto de guild se fija el guildId y se habilitan asignado y
    // supervisor; una quest personal no tiene ninguno de esos campos.
    ...(guild && {
      guildId: guild.guildId,
      assigneeId: undefined,
      supervisorId: undefined,
    }),
  }

  const form = useForm({
    defaultValues,
    ...submitGatedFormOptions,
    onSubmit: async ({ value }) => {
      setServerError(null)

      try {
        await createQuest({ data: value })

        // Refrescar las vistas afectadas: en un guild, su tabla de quests y su
        // detalle (stats/actividad de Overview); fuera, la lista personal.
        if (guild) {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ['guild', guild.slug, 'quests'],
            }),
            queryClient.invalidateQueries({ queryKey: ['guild', guild.slug] }),
          ])
        } else {
          await queryClient.invalidateQueries({ queryKey: ['quests'] })
        }

        form.reset()
        onSuccess?.()
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.'
        setServerError(message)
      }
    },
  })

  // Validadores de campo exportados para uso en el componente. Asignado y
  // supervisor se eligen de una lista cerrada de miembros, así que su validez
  // (pertenencia al guild) se comprueba en el servidor, no por campo.
  const validators = {
    title: {
      onDynamic: zodFieldValidator(questTitleSchema),
    },
    description: {
      onDynamic: zodFieldValidator(questDescriptionSchema),
    },
    priority: {
      onDynamic: zodFieldValidator(questPrioritySchema),
    },
    dueDate: {
      onDynamic: zodFieldValidator(questDueDateSchema),
    },
  }

  return { form, validators, serverError, minDueDate }
}
