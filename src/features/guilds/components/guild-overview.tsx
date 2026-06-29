import { CheckCircle2, Clock, Pencil, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from '#/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

// Estadísticas mockeadas del guild
const MOCK_STATS = [
  { label: 'Active Quests', value: 12 },
  { label: 'In Progress', value: 5 },
  { label: 'Completed this week', value: 8 },
] as const

// Miembros mockeados — solo los primeros se muestran en la preview de avatares
const MOCK_MEMBERS = [
  { id: '1', initials: 'LC', name: 'Luis Chavez' },
  { id: '2', initials: 'JD', name: 'Jane Doe' },
  { id: '3', initials: 'AB', name: 'Alice Brown' },
  { id: '4', initials: 'MK', name: 'Max Kim' },
  { id: '5', initials: 'SP', name: 'Sara Park' },
] as const

const TOTAL_MEMBERS = 24

type ActivityAction = 'completed' | 'started' | 'created' | 'updated'

const ACTIVITY_ICONS: Record<ActivityAction, LucideIcon> = {
  completed: CheckCircle2,
  started: Clock,
  created: Plus,
  updated: Pencil,
}

const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  completed: 'Completed',
  started: 'Started',
  created: 'Created',
  updated: 'Updated',
}

// Actividad reciente mockeada
const MOCK_ACTIVITY: Array<{
  id: string
  quest: string
  action: ActivityAction
  time: string
}> = [
  { id: '1', quest: "Dragon's Lair", action: 'completed', time: '2 hours ago' },
  { id: '2', quest: 'Goblin Hunt', action: 'started', time: '5 hours ago' },
  { id: '3', quest: 'Crystal Mines', action: 'created', time: '1 day ago' },
  { id: '4', quest: 'Dark Forest Expedition', action: 'updated', time: '2 days ago' },
  { id: '5', quest: 'Ancient Ruins', action: 'completed', time: '3 days ago' },
]

export function GuildOverview() {
  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Fila de estadísticas */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {MOCK_STATS.map((stat) => (
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
            <div className="flex items-center gap-4">
              <AvatarGroup>
                {MOCK_MEMBERS.map((member) => (
                  <Avatar key={member.id} title={member.name}>
                    <AvatarFallback>{member.initials}</AvatarFallback>
                  </Avatar>
                ))}
                <AvatarGroupCount>
                  +{TOTAL_MEMBERS - MOCK_MEMBERS.length}
                </AvatarGroupCount>
              </AvatarGroup>
              <p className="text-sm text-muted-foreground">
                {TOTAL_MEMBERS} members
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actividad reciente */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {MOCK_ACTIVITY.map((item) => {
              const Icon = ACTIVITY_ICONS[item.action]
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon size={13} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.quest}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ACTIVITY_LABELS[item.action]} · {item.time}
                    </p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
