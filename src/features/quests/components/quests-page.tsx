/**
 * QuestsPage — página de listado de quests.
 * Usa Suspense para el estado de carga mientras QuestsTable resuelve los datos.
 */
import { Suspense } from 'react'

import { DataTable } from '#/components/ui/data-table'
import { questsColumns } from './quests-columns'
import { QuestsTable } from './quests-table'

function QuestsTableSkeleton() {
  return (
    <DataTable
      columns={questsColumns}
      data={[]}
      isLoading
      defaultPageSize={10}
    />
  )
}

export function QuestsPage() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Quests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage your active quests.
          </p>
        </div>
      </header>

      {/* Suspense: muestra skeleton hasta que QuestsTable termina de cargar */}
      <Suspense fallback={<QuestsTableSkeleton />}>
        <QuestsTable />
      </Suspense>
    </div>
  )
}
