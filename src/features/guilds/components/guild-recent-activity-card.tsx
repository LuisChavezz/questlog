/**
 * GuildRecentActivityCard — tarjeta "Recent Activity" del Overview. Muestra las
 * 5 entradas más recientes de `guild_quest_activity_log` (vía server fn) y abre,
 * con "View all", el modal del historial completo. El drawer de detalle NO vive
 * aquí sino en el Overview (lo comparten tarjeta y modal vía `onOpenQuest`).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Button } from '#/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import type { MemberOption } from '#/features/quests/components/member-select'
import { guildRecentActivityQueryOptions } from '../api/guild-query-options'
import { ActivityLogEntry } from './activity-log-entry'
import { GuildActivityModal } from './guild-activity-modal'

export function GuildRecentActivityCard({
  slug,
  members,
  onOpenQuest,
}: {
  slug: string
  members: MemberOption[]
  onOpenQuest: (questId: string) => void
}) {
  const { data, isError } = useQuery(guildRecentActivityQueryOptions(slug))
  const [modalOpen, setModalOpen] = useState(false)

  const entries = data ?? []
  const hasActivity = entries.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        {/* "View all" solo aporta si hay algo que paginar. */}
        {hasActivity && (
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-my-1 h-7 text-muted-foreground"
              onClick={() => setModalOpen(true)}
            >
              View all
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {isError ? (
          <p className="text-sm text-muted-foreground">
            Failed to load activity.
          </p>
        ) : !hasActivity ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          entries.map((entry) => (
            <ActivityLogEntry
              key={entry.id}
              entry={entry}
              members={members}
              onOpenQuest={onOpenQuest}
            />
          ))
        )}
      </CardContent>

      <GuildActivityModal
        slug={slug}
        members={members}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </Card>
  )
}
