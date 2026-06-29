import { Shield } from 'lucide-react'

import { Badge } from '#/components/ui/badge'

// Datos mockeados temporales — el slug se usará como clave de query cuando
// se implemente el fetching real del detalle del guild
const MOCK_GUILD = {
  name: 'The Fellowship',
  description: 'A guild for adventurers seeking epic quests.',
  role: 'owner' as const,
}

const ROLE_BADGE_VARIANT = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
} as const

const ROLE_LABEL = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
} as const

export function GuildDetailHeader({ slug: _slug }: { slug: string }) {
  const { name, description, role } = MOCK_GUILD

  return (
    <header className="bg-background px-8 pt-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Shield size={24} aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-semibold text-foreground">
              {name}
            </h1>
            <Badge variant={ROLE_BADGE_VARIANT[role]} className="shrink-0">
              {ROLE_LABEL[role]}
            </Badge>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {/* Divisor inset: al estar dentro del contenedor con px-8, respeta el mismo sangrado */}
      <div className="mt-6 h-px bg-border" />
    </header>
  )
}
