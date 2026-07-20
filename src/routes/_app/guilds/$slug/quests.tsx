import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

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

export const Route = createFileRoute('/_app/guilds/$slug/quests')({
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
}: {
  slug: string
  currentUserId: string
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
        <GuildQuestsTable slug={slug} currentUserId={session.user.id} />
      </Suspense>
    </div>
  )
}
