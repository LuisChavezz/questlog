import { useState } from 'react'

import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, RefreshCw } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { regenerateInviteCode } from '#/features/guilds/api/regenerate-invite-code'
import { guildQueryOptions } from '#/features/guilds/api/guild-query-options'
import { useLeaveGuild } from '#/features/guilds/hooks/use-leave-guild'
import { isGuildOwner } from '#/features/guilds/role-labels'
import { getInviteUrl } from '#/features/guilds/schemas/guild-schemas'

export const Route = createFileRoute('/_app/guilds/$slug/settings')({
  // Sin guard de owner: la membresía ya la garantiza el loader del layout padre
  // ($slug), que lanza si el usuario no pertenece al guild. Las secciones
  // owner-only se filtran dentro del componente por rol.
  component: GuildSettingsPage,
})

function GuildSettingsPage() {
  const { slug } = Route.useParams()
  const { session } = Route.useRouteContext()
  const { data } = useQuery(guildQueryOptions(slug))
  const queryClient = useQueryClient()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const leaveGuild = useLeaveGuild(slug, () => setLeaveOpen(false))

  // Owner estructural (guilds.owner_id) — decide qué secciones se muestran
  const isOwner = data
    ? isGuildOwner(data.guild.ownerId, session.user.id)
    : false
  const guildName = data?.guild.name ?? 'this guild'

  const inviteCode = data?.guild.inviteCode ?? ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteLink = getInviteUrl(inviteCode, origin)

  async function copyToClipboard(
    text: string,
    setCopied: (v: boolean) => void,
  ) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleRegenerate() {
    if (!data) return
    await regenerateInviteCode({ data: { guildId: data.guild.id } })
    // Invalidar para que la query traiga el nuevo invite_code
    await queryClient.invalidateQueries({ queryKey: ['guild', slug] })
  }

  return (
    <div className="flex flex-col gap-8 p-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Guild Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isOwner
            ? "Manage your guild's invitation settings and membership."
            : 'Manage your guild membership.'}
        </p>
      </div>

      {/* Sección de invitación — solo el owner administra las invitaciones.
          id como ancla de scroll desde el botón "Invite Member" */}
      {isOwner && (
        <section id="invitation" className="flex flex-col gap-5">
          {/* Campo de link completo de invitación */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-link">Invite Link</Label>
            <div className="flex gap-2">
              <Input
                id="invite-link"
                readOnly
                value={inviteLink}
                className="text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy invite link"
                onClick={() => copyToClipboard(inviteLink, setCopiedLink)}
              >
                {copiedLink ? (
                  <Check size={16} className="text-green-600" />
                ) : (
                  <Copy size={16} />
                )}
              </Button>
            </div>
          </div>

          {/* Botón para regenerar */}
          <div className="flex flex-col gap-1.5">
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => setConfirmOpen(true)}
            >
              <RefreshCw size={15} className="mr-2" />
              Regenerate Invite Code
            </Button>
            <p className="text-xs text-muted-foreground">
              The previous code will stop working immediately.
            </p>
          </div>
        </section>
      )}

      {/* Salir del guild — acción auto-dirigida. El owner debe transferir la
          propiedad primero, así que ve un estado explicado en vez del botón */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">Leave Guild</h3>

        {isOwner ? (
          <>
            <Button variant="destructive" className="w-fit" disabled>
              Leave Guild
            </Button>
            <p className="text-xs text-muted-foreground">
              As the owner, you must{' '}
              <Link
                to="/guilds/$slug/members"
                params={{ slug }}
                className="font-medium text-foreground underline underline-offset-4"
              >
                transfer ownership
              </Link>{' '}
              before you can leave this guild.
            </p>
          </>
        ) : (
          <>
            <Button
              variant="destructive"
              className="w-fit"
              onClick={() => setLeaveOpen(true)}
              disabled={leaveGuild.isPending}
            >
              Leave Guild
            </Button>
            <p className="text-xs text-muted-foreground">
              You'll lose access to this guild's quests and data.
            </p>
            {leaveGuild.error && (
              <p className="text-xs text-destructive">
                {leaveGuild.error.message}
              </p>
            )}
          </>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Regenerate Invite Code?"
        description="The current invite code will stop working immediately. Anyone with the old link won't be able to join the guild."
        confirmLabel="Regenerate"
        variant="destructive"
        onConfirm={handleRegenerate}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={`Leave ${guildName}?`}
        description="You'll lose access to this guild's quests and data. You can rejoin later if invited again."
        confirmLabel="Leave Guild"
        variant="destructive"
        onConfirm={async () => {
          try {
            await leaveGuild.mutateAsync()
          } catch {
            // El error queda en leaveGuild.error y se muestra en la sección
          }
        }}
      />
    </div>
  )
}
