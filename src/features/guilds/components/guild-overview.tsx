import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, Pencil, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { AvatarGroup, AvatarGroupCount } from '#/components/ui/avatar'
import { UserAvatar } from '#/components/user-avatar'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { cn } from '#/lib/utils'
import { guildQueryOptions } from '../api/guild-query-options'
import type { GuildDetail } from '../api/get-guild'

type QuestStatus = GuildDetail['recentActivity'][number]['status']

const STATUS_ICON: Record<QuestStatus, LucideIcon> = {
  done: CheckCircle2,
  in_progress: Clock,
  backlog: Plus,
  todo: Plus,
  cancelled: Pencil,
}

const STATUS_LABEL: Record<QuestStatus, string> = {
  done: 'Completed',
  in_progress: 'In Progress',
  backlog: 'Added',
  todo: 'Added',
  cancelled: 'Cancelled',
}

// Tiempo relativo legible sin librería externa
function getRelativeTime(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
}

// Número máximo de avatares visibles antes del contador "+N"
const MAX_VISIBLE_MEMBERS = 5

export function GuildOverview() {
  const { slug } = useParams({ from: '/_app/guilds/$slug/' })
  const { data, isError } = useQuery(guildQueryOptions(slug))

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

  const recentActivity = data?.recentActivity ?? []

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

        {/* Actividad reciente */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent activity.
              </p>
            ) : (
              recentActivity.map((item) => {
                const Icon = STATUS_ICON[item.status]
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon size={13} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {STATUS_LABEL[item.status]} ·{' '}
                        {getRelativeTime(item.updatedAt)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
