import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { UserAvatar } from '#/components/user-avatar'
import { dateFormatter } from '#/lib/format-date'
import { guildQueryOptions } from '../api/guild-query-options'
import {
  ROLE_BADGE_VARIANT,
  ROLE_LABEL,
  sortMembersByRole,
} from '../role-labels'
import type { GuildMember } from '../role-labels'

export function GuildMembersPage() {
  const { slug } = useParams({ from: '/_app/guilds/$slug/members' })
  const { data, isError } = useQuery(guildQueryOptions(slug))

  // Solo mostramos el error a pantalla completa si no hay datos previos que
  // mostrar — un refetch en segundo plano fallido no debe descartar la lista
  // de miembros ya cargada
  if (isError && !data) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <p className="text-sm text-muted-foreground">Failed to load members.</p>
      </div>
    )
  }

  const members = sortMembersByRole(data?.members ?? [])
  // Solo el dueño del guild administra invitaciones — mismo criterio que el ítem "Settings" del sub-nav
  const canInvite = data?.currentUserRole === 'owner'

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
        {canInvite && (
          <Button asChild>
            <Link
              to="/guilds/$slug/settings"
              params={{ slug }}
              hash="invitation"
            >
              Invite Member
            </Link>
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  )
}

function MemberRow({ member }: { member: GuildMember }) {
  return (
    <div className="flex items-center gap-3 border-b border-border p-4 transition-colors last:border-0 hover:bg-muted/30">
      <UserAvatar
        name={member.name}
        image={member.image}
        avatarId={member.avatarId}
        initials={member.initials}
        size="lg"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {member.name}
        </p>
        <p className="text-xs text-muted-foreground">
          Joined {dateFormatter.format(new Date(member.joinedAt))}
        </p>
      </div>
      <Badge variant={ROLE_BADGE_VARIANT[member.role]} className="shrink-0">
        {ROLE_LABEL[member.role]}
      </Badge>
    </div>
  )
}
