import { Link, useParams, useRouteContext } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'

import { AvatarGroup, AvatarGroupCount } from '#/components/ui/avatar'
import { UserAvatar } from '#/components/user-avatar'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { cn } from '#/lib/utils'
import { guildQueryOptions } from '../api/guild-query-options'
import { GuildRecentActivityCard } from './guild-recent-activity-card'
import { useGuildActivityDrawer } from './use-guild-activity-drawer'

// Número máximo de avatares visibles antes del contador "+N"
const MAX_VISIBLE_MEMBERS = 5

export function GuildOverview() {
  const { slug } = useParams({ from: '/_app/guilds/$slug/' })
  const { session } = useRouteContext({ from: '/_app/guilds/$slug/' })
  const { data, isError } = useQuery(guildQueryOptions(slug))

  // Drawer de detalle de quest, compartido por la tarjeta y el modal de
  // actividad (ambos enlazan a él vía `openQuest`). Se declara antes del early
  // return de error para no romper el orden de hooks.
  const { openQuest, drawer } = useGuildActivityDrawer(
    slug,
    session.user.id,
    data,
  )

  if (isError) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <p className="text-sm text-muted-foreground">
          Failed to load guild overview.
        </p>
      </div>
    )
  }

  // `statusFilter` es la lista de `QuestStatus` (separada por comas) que el
  // stat card enlaza vía `?status=` — mismo criterio que `getGuild` usa para
  // calcular cada conteo, así que un clic siempre aterriza en el filtro que
  // realmente explica ese número:
  //  - Active Quests   → todo lo que NO es done/cancelled (espejo de
  //    `notInArray(quests.status, ['done', 'cancelled'])` en el servidor).
  //  - In Progress     → status = in_progress.
  //  - Completed this week → status = done. La tabla no tiene un filtro de
  //    fecha (de completado ni de actualización), así que el clic solo puede
  //    replicar la mitad "status" del stat — pierde la acotación temporal
  //    "this week", no hay forma de expresarla hoy con el filtro existente.
  const stats = [
    {
      label: 'Active Quests',
      value: data?.stats.activeCount ?? '—',
      statusFilter: 'backlog,todo,in_progress',
    },
    {
      label: 'In Progress',
      value: data?.stats.inProgressCount ?? '—',
      statusFilter: 'in_progress',
    },
    {
      label: 'Completed this week',
      value: data?.stats.completedThisWeekCount ?? '—',
      statusFilter: 'done',
    },
  ]

  // Overdue va aparte de `stats`: enlaza a `?overdue=true` (no a `?status=`) y
  // se resalta en rojo (`text-destructive`), el mismo token con el que ya se
  // pintan las fechas vencidas y la prioridad Critical. Se colorea solo cuando
  // hay algo vencido — un "0" en rojo alarmaría sin motivo.
  const overdueValue = data?.stats.overdueCount ?? '—'
  const hasOverdue = (data?.stats.overdueCount ?? 0) > 0

  const members = data?.members ?? []
  const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS)
  const extraCount = Math.max(0, members.length - MAX_VISIBLE_MEMBERS)

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Fila de estadísticas */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to="/guilds/$slug/quests"
            params={{ slug }}
            search={{ status: stat.statusFilter }}
            className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="gap-2 py-5 transition-colors group-hover:border-primary/40 group-hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Overdue — cuarta tarjeta, misma afordancia de hover que las demás
            pero con señal de urgencia (rojo destructive). Enlaza al filtro
            "Due date: Overdue" (`?overdue=true`), que la ruta siembra al
            montar y que expande el panel de filtros automáticamente. */}
        <Link
          to="/guilds/$slug/quests"
          params={{ slug }}
          search={{ overdue: true }}
          className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card
            className={cn(
              'gap-2 py-5 transition-colors group-hover:shadow-md',
              hasOverdue
                ? 'group-hover:border-destructive/40'
                : 'group-hover:border-primary/40',
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <AlertTriangle
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  'text-3xl font-bold',
                  hasOverdue ? 'text-destructive' : 'text-foreground',
                )}
              >
                {overdueValue}
              </p>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Widgets: miembros y actividad reciente */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Widget de miembros — enlaza a la página de miembros del guild, mismo
            tratamiento hover que las stat cards de arriba */}
        <Link
          to="/guilds/$slug/members"
          params={{ slug }}
          className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="transition-colors group-hover:border-primary/40 group-hover:shadow-md">
            <CardHeader>
              <CardTitle>Members</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <AvatarGroup>
                    {visibleMembers.map((member) => (
                      <UserAvatar
                        key={member.id}
                        title={member.name}
                        name={member.name}
                        avatarId={member.avatarId}
                        initials={member.initials}
                      />
                    ))}
                    {extraCount > 0 && (
                      <AvatarGroupCount>+{extraCount}</AvatarGroupCount>
                    )}
                  </AvatarGroup>
                  <p className="text-sm text-muted-foreground">
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Actividad reciente — datos reales de guild_quest_activity_log */}
        <GuildRecentActivityCard
          slug={slug}
          members={members}
          onOpenQuest={openQuest}
        />
      </div>

      {/* Drawer de detalle: se abre al hacer clic en una quest de la actividad
          (desde la tarjeta o el modal). Es un overlay no modal que convive con
          el Overview. */}
      {drawer}
    </div>
  )
}
