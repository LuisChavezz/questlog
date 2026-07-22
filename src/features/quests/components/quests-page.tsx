/**
 * QuestsPage — página de listado de quests.
 * Usa Suspense para el estado de carga mientras QuestsTable resuelve los datos.
 */
import { Suspense } from 'react'

import { DataTable } from '#/components/ui/data-table'
import {
  QUEST_TABLE_STICKY_LEADING_COLUMN_IDS,
  questsColumns,
} from './quests-columns'
import { QuestsTable } from './quests-table'

// Skeleton de una sola tabla: cuántas secciones habrá (y con qué columnas) solo
// se sabe una vez resueltas las quests y los guilds, así que se muestra la forma
// mínima garantizada — la sección personal, que siempre existe.
function QuestsTableSkeleton() {
  return (
    <DataTable
      columns={questsColumns}
      data={[]}
      isLoading
      defaultPageSize={10}
      stickyLeadingColumnIds={QUEST_TABLE_STICKY_LEADING_COLUMN_IDS}
    />
  )
}

export function QuestsPage({ currentUserId }: { currentUserId: string }) {
  return (
    <div className="flex flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Quests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal quests, plus the guild quests you own or supervise.
        </p>
      </header>

      {/* Suspense: muestra skeleton hasta que QuestsTable termina de cargar */}
      <Suspense fallback={<QuestsTableSkeleton />}>
        <QuestsTable currentUserId={currentUserId} />
      </Suspense>
    </div>
  )
}
