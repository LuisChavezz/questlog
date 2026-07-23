import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { z } from 'zod'

import { DataTable } from '#/components/ui/data-table'
import { CreateQuestDialog } from '#/features/quests/components/create-quest-dialog'
import {
  guildQueryOptions,
  guildQuestsQueryOptions,
} from '#/features/guilds/api/guild-query-options'
import { canCreateGuildQuest } from '#/features/guilds/role-labels'
import {
  guildQuestsColumns,
  QUEST_TABLE_STICKY_LEADING_COLUMN_IDS,
} from '#/features/quests/components/quests-columns'
import { QuestsTableContent } from '#/features/quests/components/quests-table'
import { parseQuestStatusListParam } from '#/features/quests/schemas/quest-schemas'

/**
 * Search params de la ruta — los usan las tarjetas del Guild Overview para
 * enlazar aquí con un filtro de la tabla ya precargado:
 *  - `status`: precarga el filtro de Status (lista de estados separada por comas).
 *  - `overdue=true`: precarga el filtro "Due date" con la opción Overdue.
 * Valores inválidos caen a `undefined` (`.catch`) en vez de romper la navegación.
 */
const guildQuestsSearchSchema = z.object({
  status: z.string().optional().catch(undefined),
  overdue: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/guilds/$slug/quests')({
  validateSearch: guildQuestsSearchSchema,
  // Precargamos las quests del guild y su detalle (miembros para los selectores)
  loader: ({ params, context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(guildQuestsQueryOptions(params.slug)),
      queryClient.ensureQueryData(guildQueryOptions(params.slug)),
    ]),
  component: GuildQuestsPage,
})

// Hijo de Suspense — usa useSuspenseQuery para garantizar datos (quests + guild)
// antes de renderizar la tabla con contexto de guild.
function GuildQuestsTable({
  slug,
  currentUserId,
  initialColumnFilters,
}: {
  slug: string
  currentUserId: string
  initialColumnFilters: ColumnFiltersState
}) {
  const { data: quests } = useSuspenseQuery(guildQuestsQueryOptions(slug))
  const { data: guild } = useSuspenseQuery(guildQueryOptions(slug))

  // Solo el Guild Master y los Officers pueden crear quests de guild. La misma
  // regla se aplica en el servidor (create-quest); aquí solo ocultamos el CTA.
  const canCreate = canCreateGuildQuest({
    viewerId: currentUserId,
    viewerRole: guild.currentUserRole,
    ownerId: guild.guild.ownerId,
  })

  return (
    <QuestsTableContent
      quests={quests}
      initialColumnFilters={initialColumnFilters}
      guildContext={{
        slug,
        members: guild.members,
        currentUserId,
        currentUserRole: guild.currentUserRole,
        guildOwnerId: guild.guild.ownerId,
      }}
      actions={
        canCreate ? (
          <CreateQuestDialog
            guild={{
              guildId: guild.guild.id,
              slug,
              members: guild.members,
            }}
          />
        ) : undefined
      }
    />
  )
}

function GuildQuestsPage() {
  const { slug } = Route.useParams()
  // La sesión está garantizada por el guard de _app; da el id del usuario actual
  const { session } = Route.useRouteContext()
  const { status, overdue } = Route.useSearch()

  // Semilla de los chips de filtro: solo se lee UNA vez, al montar (ver
  // `initialColumnFilters` en `DataTable`) — navegar de nuevo a esta misma ruta
  // con otros search params remonta `GuildQuestsTable` (cambia `key`, ver
  // `seedKey`) para que la nueva semilla sí se aplique, en vez de quedar pegada
  // a la primera. El filtro "Due date" se siembra con la opción `overdue`: un
  // valor no vacío es lo que hace que realmente filtre (uno vacío = sin filtro).
  const statusValues = parseQuestStatusListParam(status)
  const initialColumnFilters: ColumnFiltersState = [
    ...(statusValues.length > 0 ? [{ id: 'status', value: statusValues }] : []),
    ...(overdue ? [{ id: 'dueDate', value: ['overdue'] }] : []),
  ]

  // Clave de remontaje: combina TODOS los search params que siembran filtros,
  // no solo `status` — si no, ir de `/quests` (sin params) a `?overdue=true`
  // dejaría la misma clave y la semilla no se re-aplicaría.
  const seedKey = `${status ?? ''}::${overdue ? 'overdue' : ''}`

  return (
    <div className="flex flex-col gap-6 p-8">
      <Suspense
        fallback={
          <DataTable
            columns={guildQuestsColumns}
            data={[]}
            isLoading
            defaultPageSize={10}
            stickyLeadingColumnIds={QUEST_TABLE_STICKY_LEADING_COLUMN_IDS}
          />
        }
      >
        <GuildQuestsTable
          key={seedKey}
          slug={slug}
          currentUserId={session.user.id}
          initialColumnFilters={initialColumnFilters}
        />
      </Suspense>
    </div>
  )
}
