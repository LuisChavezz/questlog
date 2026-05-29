/**
 * QuestsTable — tabla de quests conectada a TanStack Query.
 * Obtiene los datos vía server function, los muestra en el DataTable reutilizable
 * y permite edición inline campo a campo.
 */
import { useMemo } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'

import { DataTable } from '#/components/ui/data-table'
import { questsQueryOptions } from '../api/quests-query-options'
import { useUpdateQuest } from '../hooks/use-update-quest'
import { createQuestsColumns } from './quests-columns'
import { CreateQuestDialog } from './create-quest-dialog'

export function QuestsTable() {
  // useSuspenseQuery garantiza que los datos estén disponibles antes de renderizar.
  // El Suspense boundary en QuestsPage muestra el skeleton mientras carga.
  const { data: quests } = useSuspenseQuery(questsQueryOptions)
  const { mutate: updateQuest } = useUpdateQuest()

  // Memoizar columnas para evitar recreaciones innecesarias.
  // updateQuest de useMutation es una referencia estable.
  const columns = useMemo(() => createQuestsColumns(updateQuest), [updateQuest])

  return (
    <DataTable
      columns={columns}
      data={quests}
      getRowId={(quest) => quest.id}
      filterPlaceholder="Search quests..."
      defaultPageSize={10}
      actions={<CreateQuestDialog />}
    />
  )
}
