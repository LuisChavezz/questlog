/**
 * QuestsTable — tabla de quests conectada a TanStack Query.
 * Obtiene los datos vía server function, los muestra en el DataTable reutilizable
 * y permite edición inline campo a campo.
 */
import { useMemo } from 'react'
import { Activity, Flag } from 'lucide-react'
import { useSuspenseQuery } from '@tanstack/react-query'

import { DataTable } from '#/components/ui/data-table'
import type { DataTableBulkAction } from '#/components/ui/data-table-bulk-actions'
import type { Quest, QuestPriority, QuestStatus } from '#/db/schema'
import { questsQueryOptions } from '../api/quests-query-options'
import { useBulkUpdateQuests } from '../hooks/use-bulk-update-quests'
import { useUpdateQuest } from '../hooks/use-update-quest'
import {
  createQuestsColumns,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
} from './quests-columns'
import { CreateQuestDialog } from './create-quest-dialog'

export function QuestsTable() {
  // useSuspenseQuery garantiza que los datos estén disponibles antes de renderizar.
  // El Suspense boundary en QuestsPage muestra el skeleton mientras carga.
  const { data: quests } = useSuspenseQuery(questsQueryOptions)
  const { mutate: updateQuest } = useUpdateQuest()
  const { mutateAsync: bulkUpdateQuests, isPending: isBulkUpdating } = useBulkUpdateQuests()

  // Memoizar columnas para evitar recreaciones innecesarias.
  // updateQuest de useMutation es una referencia estable.
  const columns = useMemo(() => createQuestsColumns(updateQuest), [updateQuest])
  const bulkActions = useMemo<DataTableBulkAction<Quest>[]>(
    () => [
      {
        id: 'status',
        kind: 'menu',
        label: 'Change Status',
        icon: Activity,
        options: STATUS_OPTIONS.map(({ value, label, icon }) => ({ value, label, icon })),
        disabled: isBulkUpdating,
        onSelect: async (value, { items }) => {
          await bulkUpdateQuests({
            ids: items.map((quest) => quest.id),
            status: value as QuestStatus,
          })
        },
      },
      {
        id: 'priority',
        kind: 'menu',
        label: 'Change Priority',
        icon: Flag,
        options: PRIORITY_OPTIONS.map(({ value, label, icon }) => ({ value, label, icon })),
        disabled: isBulkUpdating,
        onSelect: async (value, { items }) => {
          await bulkUpdateQuests({
            ids: items.map((quest) => quest.id),
            priority: value as QuestPriority,
          })
        },
      },
    ],
    [bulkUpdateQuests, isBulkUpdating],
  )

  return (
    <DataTable
      bulkActions={bulkActions}
      columns={columns}
      data={quests}
      getRowId={(quest) => quest.id}
      filterPlaceholder="Search quests..."
      defaultPageSize={10}
      actions={<CreateQuestDialog />}
    />
  )
}
