import { useState } from 'react'

import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, RefreshCw } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { regenerateInviteCode } from '#/features/guilds/api/regenerate-invite-code'
import { guildQueryOptions } from '#/features/guilds/api/guild-query-options'
import { getInviteUrl } from '#/features/guilds/schemas/guild-schemas'
import type { GuildDetail } from '#/features/guilds/api/get-guild'

export const Route = createFileRoute('/_app/guilds/$slug/settings')({
  beforeLoad: ({ params, context }) => {
    // El loader del layout padre ya aseguró el cache — verificar ownership sin red
    const cached = context.queryClient.getQueryData<GuildDetail>([
      'guild',
      params.slug,
    ])
    if (cached && cached.guild.ownerId !== context.session.user.id) {
      throw redirect({ to: '/guilds/$slug', params: { slug: params.slug } })
    }
  },
  component: GuildSettingsPage,
})

function GuildSettingsPage() {
  const { slug } = Route.useParams()
  const { session } = Route.useRouteContext()
  const { data } = useQuery(guildQueryOptions(slug))
  const queryClient = useQueryClient()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Verificación de ownership en el cliente — refuerza el beforeLoad
  if (data && data.guild.ownerId !== session.user.id) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
      </div>
    )
  }

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
          Manage your guild's invitation settings.
        </p>
      </div>

      {/* Sección de invitación — id como ancla de scroll desde el botón "Invite Member" */}
      <section id="invitation" className="flex flex-col gap-5">
        <h3 className="text-sm font-medium text-foreground">Invitation</h3>

        {/* Campo de código de invitación */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-code">Invite Code</Label>
          <div className="flex gap-2">
            <Input
              id="invite-code"
              readOnly
              value={inviteCode}
              className="font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy invite code"
              onClick={() => copyToClipboard(inviteCode, setCopiedCode)}
            >
              {copiedCode ? (
                <Check size={16} className="text-green-600" />
              ) : (
                <Copy size={16} />
              )}
            </Button>
          </div>
        </div>

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

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Regenerate Invite Code?"
        description="The current invite code will stop working immediately. Anyone with the old link won't be able to join the guild."
        confirmLabel="Regenerate"
        variant="destructive"
        onConfirm={handleRegenerate}
      />
    </div>
  )
}
