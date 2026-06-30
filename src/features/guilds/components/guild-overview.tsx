import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, Pencil, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from '#/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
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

  const stats = [
    { label: 'Active Quests', value: data?.stats.activeCount ?? '—' },
    { label: 'In Progress', value: data?.stats.inProgressCount ?? '—' },
    {
      label: 'Completed this week',
      value: data?.stats.completedThisWeekCount ?? '—',
    },
  ]

  const members = data?.members ?? []
  const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS)
  const extraCount = Math.max(0, members.length - MAX_VISIBLE_MEMBERS)

  const recentActivity = data?.recentActivity ?? []

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Fila de estadísticas */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-2 py-5">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Widgets: miembros y actividad reciente */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Widget de miembros */}
        <Card>
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
                    <Avatar key={member.id} title={member.name}>
                      <AvatarFallback>{member.initials}</AvatarFallback>
                    </Avatar>
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

        {/* Actividad reciente */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
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
                        {STATUS_LABEL[item.status]} · {getRelativeTime(item.updatedAt)}
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
