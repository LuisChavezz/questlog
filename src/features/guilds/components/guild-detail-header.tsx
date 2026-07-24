import { useQuery } from '@tanstack/react-query'

import { Badge } from '#/components/ui/badge'
import { guildQueryOptions } from '../api/guild-query-options'
import { GuildCoatOfArms } from './guild-coat-of-arms'
import { ROLE_BADGE_VARIANT, ROLE_LABEL } from '../role-labels'

export function GuildDetailHeader({ slug }: { slug: string }) {
  const { data } = useQuery(guildQueryOptions(slug))

  return (
    <header className="bg-background px-8 pt-6">
      <div className="flex items-start gap-4">
        {data?.guild.coatOfArmsSvg ? (
          // Escudo real: es una ilustración autocontenida con su propio borde
          // heráldico, así que se muestra directo, sin caja de fondo — a
          // diferencia del ícono genérico de abajo, que sí la necesita.
          <GuildCoatOfArms
            svg={data.guild.coatOfArmsSvg}
            className="h-12 w-12 shrink-0 object-contain"
            emblemClassName="h-6 w-6"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GuildCoatOfArms svg={null} emblemClassName="h-6 w-6" />
          </div>
        )}
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
