import { useQuery } from '@tanstack/react-query'
import { Shield } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { guildQueryOptions } from '../api/guild-query-options'
import { ROLE_BADGE_VARIANT, ROLE_LABEL } from '../role-labels'

export function GuildDetailHeader({ slug }: { slug: string }) {
  const { data } = useQuery(guildQueryOptions(slug))

  return (
    <header className="bg-background px-8 pt-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Shield size={24} aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-semibold text-foreground">
              {data?.guild.name ?? '—'}
            </h1>
            {data?.currentUserRole && (
              <Badge
                variant={ROLE_BADGE_VARIANT[data.currentUserRole]}
                className="shrink-0"
              >
                {ROLE_LABEL[data.currentUserRole]}
              </Badge>
            )}
          </div>
          {data?.guild.description && (
            <p className="text-sm text-muted-foreground">
              {data.guild.description}
            </p>
          )}
        </div>
      </div>
      {/* Divisor inset: al estar dentro del contenedor con px-8, respeta el mismo sangrado */}
      <div className="mt-6 h-px bg-border" />
    </header>
  )
}
