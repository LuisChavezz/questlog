import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'

import { createQuest } from '../api/create-quest'
import {
  questTitleSchema,
  questDescriptionSchema,
  questPrioritySchema,
  questDueDateSchema,
  getTodayDateString,
} from '../schemas/quest-schemas'
import type { CreateQuestValues } from '../schemas/quest-schemas'

// Hook que encapsula la lógica del formulario de creación de quests
export function useCreateQuestForm(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const minDueDate = getTodayDateString()

  const defaultValues: CreateQuestValues = {
    title: '',
    description: undefined,
    priority: 'medium',
    tags: undefined,
    dueDate: undefined,
  }

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setServerError(null)

      try {
        await createQuest({ data: value })

        // Invalidar query para refrescar la tabla de quests
        await queryClient.invalidateQueries({ queryKey: ['quests'] })
        form.reset()
        onSuccess?.()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.'
        setServerError(message)
      }
    },
  })

  // Validadores de campo exportados para uso en el componente
  const validators = {
    title: {
      onChange: ({ value }: { value: string }) => {
        const result = questTitleSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
    description: {
      onChange: ({ value }: { value: string | undefined }) => {
        const result = questDescriptionSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
    priority: {
      onChange: ({ value }: { value: string }) => {
        const result = questPrioritySchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
    dueDate: {
      onChange: ({ value }: { value: string | undefined }) => {
        const result = questDueDateSchema.safeParse(value)
        return result.success ? undefined : result.error.issues[0]?.message
      },
    },
  }

  return { form, validators, serverError, minDueDate }
}
