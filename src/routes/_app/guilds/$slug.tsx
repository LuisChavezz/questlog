import { createFileRoute, Outlet } from '@tanstack/react-router'

import { GuildDetailHeader } from '#/features/guilds/components/guild-detail-header'

export const Route = createFileRoute('/_app/guilds/$slug')({
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
