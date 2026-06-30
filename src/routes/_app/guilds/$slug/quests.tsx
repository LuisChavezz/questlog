import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { DataTable } from '#/components/ui/data-table'
import { guildQuestsQueryOptions } from '#/features/guilds/api/guild-query-options'
import { questsColumns } from '#/features/quests/components/quests-columns'
import { QuestsTableContent } from '#/features/quests/components/quests-table'

export const Route = createFileRoute('/_app/guilds/$slug/quests')({
  loader: ({ params, context: { queryClient } }) =>
    queryClient.ensureQueryData(guildQuestsQueryOptions(params.slug)),
  component: GuildQuestsPage,
})

// Componente hijo de Suspense — llama a useSuspenseQuery para garantizar datos
// antes de renderizar QuestsTableContent
function GuildQuestsTable({ slug }: { slug: string }) {
  const { data: quests } = useSuspenseQuery(guildQuestsQueryOptions(slug))
  return <QuestsTableContent quests={quests} />
}

function GuildQuestsPage() {
  const { slug } = Route.useParams()

  return (
    <div className="flex flex-col gap-6 p-8">
      <Suspense
        fallback={
          <DataTable
            columns={questsColumns}
            data={[]}
            isLoading
            defaultPageSize={10}
          />
        }
      >
        <GuildQuestsTable slug={slug} />
      </Suspense>
    </div>
  )
}
