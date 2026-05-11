/**
 * QuestsTable — tabla de quests conectada a TanStack Query.
 * Obtiene los datos vía server function y los muestra en el DataTable reutilizable.
 */
import { useSuspenseQuery } from '@tanstack/react-query'

import { DataTable } from '#/components/ui/data-table'
import { questsQueryOptions } from '../api/quests-query-options'
import { questsColumns } from './quests-columns'

export function QuestsTable() {
  // useSuspenseQuery garantiza que los datos estén disponibles antes de renderizar.
  // El Suspense boundary en QuestsPage muestra el skeleton mientras carga.
  const { data: quests } = useSuspenseQuery(questsQueryOptions)

  return (
    <DataTable
      columns={questsColumns}
      data={quests}
      filterPlaceholder="Search quests..."
      defaultPageSize={10}
    />
  )
}
