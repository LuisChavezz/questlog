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
import { GuildCoatOfArms } from '#/features/guilds/components/guild-coat-of-arms'
import { GuildProfileForm } from '#/features/guilds/components/guild-profile-form'
import { useDeleteGuild } from '#/features/guilds/hooks/use-delete-guild'
import { useLeaveGuild } from '#/features/guilds/hooks/use-leave-guild'
import { useRegenerateCoatOfArms } from '#/features/guilds/hooks/use-regenerate-coat-of-arms'
import { isGuildOwner } from '#/features/guilds/role-labels'
import { getInviteUrl } from '#/features/guilds/schemas/guild-schemas'
import { cn } from '#/lib/utils'

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
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const leaveGuild = useLeaveGuild(slug, () => setLeaveOpen(false))
  const deleteGuild = useDeleteGuild(slug, () => setDeleteOpen(false))
  const regenerateCoatOfArms = useRegenerateCoatOfArms(slug)

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
            ? "Manage your guild's profile, invitation settings and membership."
            : 'Manage your guild membership.'}
        </p>
      </div>

      {/* Perfil del guild — nombre y descripción, solo editables por el owner.
          Va primero porque es lo que identifica al guild en toda la app (la
          cabecera de estas mismas páginas y las cards del directorio), antes
          que los ajustes de invitación o membresía. El slug NO se edita acá:
          es inmutable tras la creación (ver guild-profile-form.tsx). El
          formulario se monta con los valores actuales como estado inicial, así
          que se remonta con `key` al cambiar el guild — sin eso, navegar entre
          guilds reusaría la instancia y dejaría los datos del anterior. */}
      {isOwner && data && (
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-foreground">Guild Profile</h3>
          <GuildProfileForm
            key={data.guild.id}
            slug={slug}
            name={data.guild.name}
            description={data.guild.description}
          />
        </section>
      )}

      {/* Sección de escudo de armas — solo el owner puede re-rolarlo. Sirve
          tanto para regenerar uno existente como para generar el primero en
          guilds creados antes de esta feature (coatOfArmsSvg null): es la
          misma operación, no hay botón separado para "primera vez". */}
      {isOwner && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">Coat of Arms</h3>
          <div className="flex items-center gap-4">
            {data?.guild.coatOfArmsSvg ? (
              // Escudo real: sin caja de fondo — mismo criterio que
              // guild-detail-header.tsx (la ilustración ya trae su propio
              // borde heráldico, a diferencia del ícono genérico de abajo)
              <GuildCoatOfArms
                svg={data.guild.coatOfArmsSvg}
                className="h-16 w-16 shrink-0 object-contain"
                emblemClassName="h-8 w-8"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GuildCoatOfArms svg={null} emblemClassName="h-8 w-8" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Button
                variant="outline"
                className="w-fit"
                onClick={() => regenerateCoatOfArms.mutate()}
                disabled={regenerateCoatOfArms.isPending}
              >
                <RefreshCw
                  size={15}
                  className={cn(
                    'mr-2',
                    regenerateCoatOfArms.isPending && 'animate-spin',
                  )}
                />
                {regenerateCoatOfArms.isPending
                  ? 'Generating…'
                  : 'Regenerate Coat of Arms'}
              </Button>
              {regenerateCoatOfArms.error && (
                <p className="text-xs text-destructive">
                  {regenerateCoatOfArms.error instanceof Error
                    ? regenerateCoatOfArms.error.message
                    : 'Something went wrong. Please try again.'}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

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

      {/* Danger Zone — acciones irreversibles. Solo el Guild Master (dueño
          estructural) llega aquí: la página de Settings es visible para todo
          miembro, así que un Officer no debe ni ver este bloque. Va separado del
          resto por su propio marco en color destructivo, al final de la página,
          para que no se confunda con los ajustes normales de arriba. */}
      {isOwner && (
        <section className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
          <h3 className="text-sm font-semibold text-destructive">
            Danger Zone
          </h3>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">Delete Guild</p>
            <p className="text-xs text-muted-foreground">
              Permanently delete {guildName}, all of its quests, and all of its
              activity history. Every member loses access. This cannot be
              undone.
            </p>
          </div>
          <Button
            variant="destructive"
            className="w-fit"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteGuild.isPending}
          >
            {deleteGuild.isPending ? 'Deleting…' : 'Delete Guild'}
          </Button>
          {/* El ConfirmDialog se cierra al fallar, así que el error se muestra
              aquí para no perderlo — mismo criterio que la salida del guild */}
          {deleteGuild.error && (
            <p className="text-xs text-destructive">
              {deleteGuild.error.message}
            </p>
          )}
        </section>
      )}

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

      {/* Borrado del guild — irreversible y en cascada, así que sube la fricción
          respecto al resto de confirmaciones: exige teclear el nombre exacto del
          guild (mismo criterio que la transferencia de propiedad). La frase se
          exige siempre: sin el detalle cargado no hay nombre contra el que
          comparar, y una cadena vacía deja el botón deshabilitado (el fallo
          seguro) en vez de convertirlo en una confirmación de un solo clic. El
          diálogo se monta bajo el mismo `isOwner` que su botón: si la propiedad
          se transfiere con Settings abierto, la puerta se cierra entera y no
          queda un diálogo huérfano al alcance de quien ya no es Guild Master. */}
      {isOwner && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Delete ${guildName}?`}
          description={`This permanently deletes ${guildName} for everyone: all of its quests and all of its activity history are erased along with it, and every member loses access. This action cannot be undone.`}
          confirmLabel="Delete Guild"
          variant="destructive"
          confirmationPhrase={data?.guild.name ?? ''}
          onConfirm={async () => {
            try {
              await deleteGuild.mutateAsync()
            } catch {
              // El error queda en deleteGuild.error y se muestra en la sección
            }
          }}
        />
      )}
    </div>
  )
}
