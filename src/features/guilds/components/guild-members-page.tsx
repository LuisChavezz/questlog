import * as React from 'react'
import { Link, useParams, useRouteContext } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Crown, MoreVertical, UserCog, UserMinus } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { UserAvatar } from '#/components/user-avatar'
import { dateFormatter } from '#/lib/format-date'
import { guildQueryOptions } from '../api/guild-query-options'
import { useRemoveGuildMember } from '../hooks/use-remove-guild-member'
import { useTransferGuildOwnership } from '../hooks/use-transfer-guild-ownership'
import { useUpdateGuildMemberRole } from '../hooks/use-update-guild-member-role'
import {
  canChangeMemberRole,
  canRemoveMember,
  canTransferOwnership,
  ROLE_BADGE_VARIANT,
  ROLE_LABEL,
  sortMembersByRole,
} from '../role-labels'
import type { GuildMember, GuildMemberViewer } from '../role-labels'
import type { AssignableGuildRole } from '../schemas/guild-schemas'

export function GuildMembersPage() {
  const { slug } = useParams({ from: '/_app/guilds/$slug/members' })
  // La sesión está garantizada por el guard de _app; da el id del usuario actual
  const { session } = useRouteContext({ from: '/_app/guilds/$slug/members' })
  const { data, isError } = useQuery(guildQueryOptions(slug))

  // Miembro objetivo de cada diálogo — solo uno activo a la vez
  const [roleTarget, setRoleTarget] = React.useState<GuildMember | null>(null)
  const [removeTarget, setRemoveTarget] = React.useState<GuildMember | null>(
    null,
  )
  const [transferTarget, setTransferTarget] =
    React.useState<GuildMember | null>(null)

  const updateRole = useUpdateGuildMemberRole(slug, () => setRoleTarget(null))
  const removeMember = useRemoveGuildMember(slug, () => setRemoveTarget(null))
  const transferOwnership = useTransferGuildOwnership(slug, () =>
    setTransferTarget(null),
  )

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

  // Contexto de permisos del usuario actual — nulo hasta que carga el detalle
  const viewer: GuildMemberViewer | null = data
    ? {
        viewerId: session.user.id,
        viewerRole: data.currentUserRole,
        ownerId: data.guild.ownerId,
      }
    : null

  const guildName = data?.guild.name ?? 'this guild'

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

      {/* Errores de expulsión: el ConfirmDialog se cierra al fallar, así que
          los mostramos aquí para no perderlos */}
      {removeMember.error && (
        <p className="text-sm text-destructive">{removeMember.error.message}</p>
      )}

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              viewer={viewer}
              onChangeRole={() => setRoleTarget(member)}
              onRemove={() => setRemoveTarget(member)}
              onTransfer={() => setTransferTarget(member)}
            />
          ))}
        </div>
      )}

      {/* Cambio de rol — solo se monta con un objetivo activo, garantizando
          estado inicial correcto del select en cada apertura */}
      {roleTarget && (
        <ChangeRoleDialog
          key={roleTarget.id}
          member={roleTarget}
          guildName={guildName}
          open
          onOpenChange={(open) => {
            if (!open) {
              setRoleTarget(null)
              // Limpiar el error al cerrar — si no, el próximo miembro cuyo
              // diálogo se abra heredaría el error de este intento
              updateRole.reset()
            }
          }}
          onConfirm={(newRole) =>
            updateRole.mutate({ userId: roleTarget.userId, newRole })
          }
          isPending={updateRole.isPending}
          error={updateRole.error}
        />
      )}

      {/* Expulsión — confirmación destructiva reutilizando ConfirmDialog */}
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null)
            // Limpiar el error al cerrar — si no, quedaría como un banner
            // huérfano tras cancelar o abrir el diálogo de otro miembro
            removeMember.reset()
          }
        }}
        title="Remove member"
        description={
          removeTarget
            ? `Remove ${removeTarget.name} from ${guildName}? They will lose access to this guild.`
            : undefined
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => {
          if (!removeTarget) return
          try {
            await removeMember.mutateAsync(removeTarget.userId)
          } catch {
            // El error queda en removeMember.error y se muestra arriba; lo
            // atrapamos para no dejar una promesa rechazada sin manejar
          }
        }}
      />

      {/* Transferencia de propiedad — acción irreversible por el propio owner,
          exige escribir el nombre del objetivo para confirmar */}
      {transferTarget && (
        <TransferOwnershipDialog
          key={transferTarget.id}
          member={transferTarget}
          guildName={guildName}
          open
          onOpenChange={(open) => {
            if (!open) setTransferTarget(null)
          }}
          onConfirm={() => transferOwnership.mutate(transferTarget.userId)}
          isPending={transferOwnership.isPending}
          error={transferOwnership.error}
        />
      )}
    </div>
  )
}

function MemberRow({
  member,
  viewer,
  onChangeRole,
  onRemove,
  onTransfer,
}: {
  member: GuildMember
  viewer: GuildMemberViewer | null
  onChangeRole: () => void
  onRemove: () => void
  onTransfer: () => void
}) {
  const canChange = viewer ? canChangeMemberRole(viewer, member) : false
  const canRemove = viewer ? canRemoveMember(viewer, member) : false
  const canTransfer = viewer ? canTransferOwnership(viewer, member) : false
  const hasActions = canChange || canRemove || canTransfer

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

      {/* Solo renderizamos el menú si hay al menos una acción permitida sobre
          esta fila — nada de menús vacíos ni en la propia fila */}
      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical />
              <span className="sr-only">Member actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canChange && (
              <DropdownMenuItem onSelect={onChangeRole}>
                <UserCog />
                Change role
              </DropdownMenuItem>
            )}
            {canTransfer && (
              <DropdownMenuItem onSelect={onTransfer}>
                <Crown />
                Transfer ownership
              </DropdownMenuItem>
            )}
            {canRemove && (canChange || canTransfer) && (
              <DropdownMenuSeparator />
            )}
            {canRemove && (
              <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                <UserMinus />
                Remove from guild
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function ChangeRoleDialog({
  member,
  guildName,
  open,
  onOpenChange,
  onConfirm,
  isPending,
  error,
}: {
  member: GuildMember
  guildName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (newRole: AssignableGuildRole) => void
  isPending: boolean
  error: Error | null
}) {
  // El owner nunca abre este diálogo, así que el rol actual es member o admin
  const [selectedRole, setSelectedRole] = React.useState<AssignableGuildRole>(
    member.role === 'admin' ? 'admin' : 'member',
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            Update {member.name}&apos;s role in {guildName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Role</span>
          <Select
            value={selectedRole}
            onValueChange={(value) =>
              setSelectedRole(value as AssignableGuildRole)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{ROLE_LABEL.member}</SelectItem>
              <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={() => onConfirm(selectedRole)}
            disabled={isPending || selectedRole === member.role}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TransferOwnershipDialog({
  member,
  guildName,
  open,
  onOpenChange,
  onConfirm,
  isPending,
  error,
}: {
  member: GuildMember
  guildName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
  error: Error | null
}) {
  // Confirmación reforzada: exigir teclear el nombre exacto del nuevo owner. Es
  // una acción irreversible por el propio owner, así que subimos la fricción
  // respecto al ConfirmDialog de expulsión.
  const [confirmText, setConfirmText] = React.useState('')
  const targetName = member.name.trim()
  // Un nombre en blanco (solo espacios) haría que un confirmText vacío
  // "coincidiera" sin que el owner tuviera que teclear nada — se bloquea la
  // transferencia por completo en vez de permitir ese atajo no intencional.
  const isTargetNameBlank = targetName === ''
  const isMatch = !isTargetNameBlank && confirmText.trim() === targetName

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer ownership to {member.name}?</DialogTitle>
          <DialogDescription>
            You will no longer be the owner of {guildName} and will become a
            regular member. This cannot be undone by yourself — only{' '}
            {member.name} could transfer it back.
          </DialogDescription>
        </DialogHeader>

        {isTargetNameBlank ? (
          <p className="text-sm text-destructive">
            This member's display name can't be used to confirm this action
            safely. Ask them to set a display name before transferring ownership
            to them.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="transfer-confirm"
              className="text-sm font-medium text-foreground"
            >
              Type <span className="font-semibold">{member.name}</span> to
              confirm
            </label>
            <Input
              id="transfer-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={member.name}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending || !isMatch}
          >
            Transfer ownership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
