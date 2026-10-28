import { useState, useSyncExternalStore } from 'react'

import { Link, useParams, useRouteContext } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, LogOut, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'

import { regenerateInviteCode } from '../api/regenerate-invite-code'
import { guildQueryOptions } from '../api/guild-query-options'
import { GuildCoatOfArms } from './guild-coat-of-arms'
import { GuildProfileForm } from './guild-profile-form'
import {
  GuildSettingsRow,
  GuildSettingsSection,
} from './guild-settings-section'
import { useDeleteGuild } from '../hooks/use-delete-guild'
import { useLeaveGuild } from '../hooks/use-leave-guild'
import { useRegenerateCoatOfArms } from '../hooks/use-regenerate-coat-of-arms'
import { isGuildOwner } from '../role-labels'
import { getInviteUrl } from '../schemas/guild-schemas'

// El origin solo existe en el navegador. useSyncExternalStore da '' en el SSR
// y durante la hidratación (getServerSnapshot), y el origin real justo
// después, así el HTML del servidor y el primer render del cliente coinciden.
const subscribeToNothing = () => () => {}
const getOrigin = () => window.location.origin
const getServerOrigin = () => ''

// Sin guard de owner: la membresía ya la garantiza el loader del layout padre
// ($slug), que lanza si el usuario no pertenece al guild. Las secciones
// owner-only se filtran aquí por rol.
export function GuildSettingsPage() {
  const { slug } = useParams({ from: '/_app/guilds/$slug/settings' })
  const { session } = useRouteContext({ from: '/_app/guilds/$slug/settings' })
  const { data } = useQuery(guildQueryOptions(slug))
  const queryClient = useQueryClient()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  const leaveGuild = useLeaveGuild(slug, () => setLeaveOpen(false))
  const deleteGuild = useDeleteGuild(slug, () => setDeleteOpen(false))
  const regenerateCoatOfArms = useRegenerateCoatOfArms(slug)

  // Owner estructural (guilds.owner_id) — decide qué secciones se muestran
  const isOwner = data
    ? isGuildOwner(data.guild.ownerId, session.user.id)
    : false
  const guildName = data?.guild.name ?? 'this guild'

  const inviteCode = data?.guild.inviteCode ?? ''
  const origin = useSyncExternalStore(
    subscribeToNothing,
    getOrigin,
    getServerOrigin,
  )
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
    setRegenerateError(null)
    try {
      await regenerateInviteCode({ data: { guildId: data.guild.id } })
    } catch (error) {
      // Se traga aquí para que el ConfirmDialog cierre y no quede un rechazo
      // sin manejar; el error se muestra en la fila "Reset Invite Link"
      setRegenerateError(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      )
      return
    }
    // Invalidar para que la query traiga el nuevo invite_code
    await queryClient.invalidateQueries({ queryKey: ['guild', slug] })
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-10 p-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Guild Settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOwner
            ? "Manage your guild's profile, invitations and membership."
            : 'Manage your guild membership.'}
        </p>
      </div>

      {/* General — identidad del guild (escudo, nombre, descripción), solo
          editable por el owner. Va primero porque es lo que identifica al guild
          en toda la app (la cabecera de estas páginas y las cards del
          directorio). El escudo vive aquí porque es parte de esa identidad,
          pero se aplica al instante: por eso va como fila con su propio botón,
          separada del formulario que sí se guarda con "Save Changes". El slug
          NO se edita: es inmutable tras la creación (ver guild-profile-form.tsx). */}
      {isOwner && data && (
        <GuildSettingsSection
          title="General"
          description="How your guild appears across Questlog."
        >
          {/* Re-rolar el escudo sirve tanto para regenerar uno existente como
              para generar el primero en guilds creados antes de esta feature
              (coatOfArmsSvg null): es la misma operación. */}
          <GuildSettingsRow
            leading={
              data.guild.coatOfArmsSvg ? (
                // Escudo real: sin caja de fondo — mismo criterio que
                // guild-detail-header.tsx (la ilustración ya trae su propio
                // borde heráldico, a diferencia del ícono genérico de abajo)
                <GuildCoatOfArms
                  svg={data.guild.coatOfArmsSvg}
                  className="h-14 w-14 shrink-0 object-contain"
                  emblemClassName="h-7 w-7"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <GuildCoatOfArms svg={null} emblemClassName="h-7 w-7" />
                </div>
              )
            }
            label="Coat of Arms"
            description="Regenerating replaces it for every member, immediately."
            error={
              regenerateCoatOfArms.error &&
              (regenerateCoatOfArms.error instanceof Error
                ? regenerateCoatOfArms.error.message
                : 'Something went wrong. Please try again.')
            }
            action={
              <Button
                variant="outline"
                onClick={() => regenerateCoatOfArms.mutate()}
                disabled={regenerateCoatOfArms.isPending}
              >
                <RefreshCw
                  size={15}
                  className={cn(
                    regenerateCoatOfArms.isPending && 'animate-spin',
                  )}
                />
                {regenerateCoatOfArms.isPending ? 'Generating…' : 'Regenerate'}
              </Button>
            }
          />

          {/* El formulario se monta con los valores actuales como estado
              inicial, así que se remonta con `key` al cambiar el guild — sin
              eso, navegar entre guilds reusaría la instancia y dejaría los
              datos del anterior. */}
          <div className="px-6 py-5">
            <GuildProfileForm
              key={data.guild.id}
              slug={slug}
              name={data.guild.name}
              description={data.guild.description}
            />
          </div>
        </GuildSettingsSection>
      )}

      {/* Invitaciones — solo el owner las administra. id como ancla de scroll
          desde el botón "Invite Member" de la página de miembros */}
      {isOwner && (
        <GuildSettingsSection
          id="invitation"
          title="Invitations"
          description={`Anyone with this link can join ${guildName}.`}
        >
          <GuildSettingsRow label="Invite Link" labelFor="invite-link">
            <div className="flex gap-2">
              <Input
                id="invite-link"
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                aria-label="Copy invite link"
                onClick={() => copyToClipboard(inviteLink, setCopiedLink)}
                className="w-24"
              >
                {copiedLink ? (
                  <Check size={16} className="text-primary" />
                ) : (
                  <Copy size={16} />
                )}
                {copiedLink ? 'Copied' : 'Copy'}
              </Button>
              {/* El cambio a "Copied" es solo visual: esta región lo anuncia
                  a los lectores de pantalla */}
              <span className="sr-only" role="status" aria-live="polite">
                {copiedLink ? 'Invite link copied' : ''}
              </span>
            </div>
          </GuildSettingsRow>
          <GuildSettingsRow
            label="Reset Invite Link"
            description="Generates a new code. The current link stops working immediately."
            error={regenerateError}
            action={
              <Button variant="outline" onClick={() => setConfirmOpen(true)}>
                <RefreshCw size={15} />
                Regenerate
              </Button>
            }
          />
        </GuildSettingsSection>
      )}

      {/* Danger Zone — salir y borrar, separadas del resto por su marco en
          color destructivo y al final de la página para que no se confundan
          con los ajustes normales. Salir la ve todo miembro; borrar solo el
          Guild Master (dueño estructural): la página es visible para todo
          miembro, así que un Officer no debe ni ver esa fila. */}
      <GuildSettingsSection title="Danger Zone" variant="destructive">
        {/* Salir del guild — acción auto-dirigida. El owner debe transferir la
            propiedad primero, así que ve el camino para hacerlo en vez de un
            botón deshabilitado */}
        {isOwner ? (
          <GuildSettingsRow
            label="Leave Guild"
            description="As the Guild Master, you must transfer ownership before you can leave this guild."
            action={
              <Button variant="outline" asChild>
                <Link to="/guilds/$slug/members" params={{ slug }}>
                  Transfer Ownership
                </Link>
              </Button>
            }
          />
        ) : (
          <GuildSettingsRow
            label="Leave Guild"
            description="You'll lose access to this guild's quests and data."
            error={leaveGuild.error?.message}
            action={
              <Button
                variant="destructive"
                onClick={() => setLeaveOpen(true)}
                disabled={leaveGuild.isPending}
              >
                <LogOut size={15} />
                Leave Guild
              </Button>
            }
          />
        )}

        {isOwner && (
          <GuildSettingsRow
            label="Delete Guild"
            description={`Permanently delete ${guildName}, all of its quests, and all of its activity history. Every member loses access. This cannot be undone.`}
            // El ConfirmDialog se cierra al fallar, así que el error se muestra
            // aquí para no perderlo — mismo criterio que la salida
            error={deleteGuild.error?.message}
            action={
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={deleteGuild.isPending}
              >
                <Trash2 size={15} />
                {deleteGuild.isPending ? 'Deleting…' : 'Delete Guild'}
              </Button>
            }
          />
        )}
      </GuildSettingsSection>

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
