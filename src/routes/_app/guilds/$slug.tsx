import { createFileRoute, Outlet } from '@tanstack/react-router'

import { guildQueryOptions } from '#/features/guilds/api/guild-query-options'
import { GuildDetailHeader } from '#/features/guilds/components/guild-detail-header'

export const Route = createFileRoute('/_app/guilds/$slug')({
  // Pre-carga el detalle del guild en el servidor antes de enviar el HTML al cliente
  loader: ({ params, context: { queryClient } }) =>
    queryClient.ensureQueryData(guildQueryOptions(params.slug)),
  component: GuildDetailPage,
})

// Layout del detalle de guild: cabecera compartida + outlet para sub-rutas
function GuildDetailPage() {
  const { slug } = Route.useParams()

  return (
    <div className="flex flex-col">
      <GuildDetailHeader slug={slug} />
      <Outlet />
    </div>
  )
}
