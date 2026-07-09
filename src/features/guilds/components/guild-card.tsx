/**
 * GuildCard — tarjeta clicable que resume un guild del usuario.
 * Muestra nombre, slug, descripción (recortada) y un badge con el rol.
 */
import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import type { GuildWithRole } from '../api/get-guilds'
import { ROLE_BADGE_VARIANT, ROLE_LABEL } from '../role-labels'

type GuildCardProps = {
  guild: GuildWithRole
}

export function GuildCard({ guild }: GuildCardProps) {
  return (
    <Link
      to="/guilds/$slug"
      params={{ slug: guild.slug }}
      className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full gap-4 py-5 transition-colors group-hover:border-primary/40 group-hover:shadow-md">
        <CardHeader className="gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="min-w-0 truncate text-base">
              {guild.name}
            </CardTitle>
            <Badge
              variant={ROLE_BADGE_VARIANT[guild.role]}
              className="shrink-0"
            >
              {ROLE_LABEL[guild.role]}
            </Badge>
          </div>
          {/* Slug discreto debajo del nombre */}
          <p className="truncate text-xs text-muted-foreground">{guild.slug}</p>
        </CardHeader>

        {guild.description && (
          <CardContent>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {guild.description}
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}
