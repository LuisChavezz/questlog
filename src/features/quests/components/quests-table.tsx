/**
 * QuestsTable — tabla de quests conectada a TanStack Query.
 * Obtiene los datos vía server function, los muestra en el DataTable reutilizable
 * y permite edición inline campo a campo.
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, Flag, Trash2 } from 'lucide-react'
import { useSuspenseQuery } from '@tanstack/react-query'

import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { DataTable } from '#/components/ui/data-table'
import type { DataTableBulkAction } from '#/components/ui/data-table-bulk-actions'
import type { Quest, QuestPriority, QuestStatus } from '#/db/schema'
import { questsQueryOptions } from '../api/quests-query-options'
import { useBulkDeleteQuests } from '../hooks/use-bulk-delete-quests'
import { useBulkUpdateQuests } from '../hooks/use-bulk-update-quests'
import { useDeleteQuest } from '../hooks/use-delete-quest'
import { useUpdateQuest } from '../hooks/use-update-quest'
import {
  createQuestsColumns,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
} from './quests-columns'
import { CreateQuestDialog } from './create-quest-dialog'

// Estado de la eliminación pendiente de confirmación en el diálogo
interface PendingDeletion {
  ids: string[]
  clearSelection: () => void
}

interface QuestsTableContentProps {
  quests: Quest[]
  actions?: ReactNode
}

// Componente presentacional reutilizable — acepta quests como prop para que
// distintas rutas (personal, guild) puedan alimentarlo con su propia query.
export function QuestsTableContent({ quests, actions }: QuestsTableContentProps) {
  const { mutate: updateQuest } = useUpdateQuest()
  const { mutateAsync: bulkUpdateQuests, isPending: isBulkUpdating } =
    useBulkUpdateQuests()
  const { mutateAsync: bulkDeleteQuests } = useBulkDeleteQuests()
  const { mutateAsync: deleteQuest } = useDeleteQuest()

  // Eliminación seleccionada pendiente de confirmación (null = diálogo cerrado)
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null)
  const pendingCount = pendingDeletion?.ids.length ?? 0

  // Ejecuta la eliminación: usa el endpoint individual para una sola quest
  // y el masivo para varias, luego limpia la selección de la tabla
  const confirmDeletion = async () => {
    if (!pendingDeletion) return

    const { ids, clearSelection } = pendingDeletion

    if (ids.length === 1) {
      await deleteQuest({ id: ids[0] })
    } else {
      await bulkDeleteQuests({ ids })
    }

    clearSelection()
  }

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
        options: STATUS_OPTIONS.map(({ value, label, icon }) => ({
          value,
          label,
          icon,
        })),
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
        options: PRIORITY_OPTIONS.map(({ value, label, icon }) => ({
          value,
          label,
          icon,
        })),
        disabled: isBulkUpdating,
        onSelect: async (value, { items }) => {
          await bulkUpdateQuests({
            ids: items.map((quest) => quest.id),
            priority: value as QuestPriority,
          })
        },
      },
      {
        // Botón solo-icono que abre el diálogo de confirmación (una o varias quests)
        id: 'delete',
        kind: 'custom',
        render: ({ items, clearSelection }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete selected quests"
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setPendingDeletion({
                ids: items.map((quest) => quest.id),
                clearSelection,
              })
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        ),
      },
    ],
    [bulkUpdateQuests, isBulkUpdating],
  )

  return (
    <>
      <DataTable
        bulkActions={bulkActions}
        columns={columns}
        data={quests}
        getRowId={(quest) => quest.id}
        filterPlaceholder="Search quests..."
        defaultPageSize={10}
        actions={actions}
      />

      <ConfirmDialog
        open={pendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null)
        }}
        variant="destructive"
        title={pendingCount === 1 ? 'Delete quest?' : 'Delete quests?'}
        description={
          pendingCount === 1
            ? 'This quest will be permanently deleted. This action cannot be undone.'
            : `These ${pendingCount} quests will be permanently deleted. This action cannot be undone.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeletion}
      />
    </>
  )
}

export function QuestsTable() {
  // useSuspenseQuery garantiza que los datos estén disponibles antes de renderizar.
  // El Suspense boundary en QuestsPage muestra el skeleton mientras carga.
  const { data: quests } = useSuspenseQuery(questsQueryOptions)
  return <QuestsTableContent quests={quests} actions={<CreateQuestDialog />} />
}
