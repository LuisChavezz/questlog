import { Link } from '@tanstack/react-router'
import { ScrollText } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { useJoinGuild } from '../hooks/use-join-guild'
import type { GuildInvitePreview } from '../api/get-guild-invite-preview'
import { GuildEmblem } from './guild-emblem'

// Datos resueltos por el loader de /invite/$code.
// `kind: 'invalid'` cubre un código inexistente/expirado sin filtrar datos.
export type GuildInviteData =
  | { kind: 'invalid'; isAuthenticated: boolean }
  | { kind: 'preview'; isAuthenticated: boolean; preview: GuildInvitePreview }

type GuildInviteProps = {
  code: string
  data: GuildInviteData
}

export function GuildInvite({ code, data }: GuildInviteProps) {
  return (
    <InvitePageShell>
      {data.kind === 'invalid' ? (
        <InvalidInvite isAuthenticated={data.isAuthenticated} />
      ) : (
        <InvitePreviewCard
          code={code}
          preview={data.preview}
          isAuthenticated={data.isAuthenticated}
        />
      )}
    </InvitePageShell>
  )
}

// ─── Shell: fondo temático centrado + marca, compartido por todos los estados ──

function InvitePageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden">
      {/* Orbs flotantes (mismos tokens que el layout de auth) para cohesión visual */}
      <div
        className="pointer-events-none absolute left-[10%] top-[-15%] h-[70vw] w-[70vw] rounded-full bg-(--lagoon) opacity-[0.18] blur-[180px] dark:opacity-[0.12]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[55vw] w-[55vw] rounded-full bg-(--palm) opacity-[0.13] blur-[160px] dark:opacity-[0.09]"
        aria-hidden="true"
      />

      <div className="animate-in fade-in slide-in-from-bottom-4 relative z-10 w-full max-w-md px-4 py-14 duration-500">
        {/* Marca / logotipo */}
        <Link
          to="/"
          className="mb-8 flex items-center justify-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-(--lagoon) to-(--palm) shadow-lg shadow-(--lagoon)/20">
            <ScrollText className="size-5 text-white" aria-hidden="true" />
          </div>
          <span
            className="text-2xl font-bold tracking-tight text-(--sea-ink) dark:text-(--sea-ink)"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Questlog
          </span>
        </Link>

        {children}
      </div>
    </div>
  )
}

// Tarjeta base con el mismo glassmorphism que las pantallas de auth
function InviteCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-(--line) bg-(--surface) px-8 py-10 text-center shadow-[0_8px_40px_rgba(0,0,0,0.10),inset_0_1px_0_var(--inset-glint)] backdrop-blur-2xl">
      {children}
    </div>
  )
}

// ─── Estado 1: código inválido o expirado ─────────────────────────────────────

function InvalidInvite({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <InviteCard>
      <div className="mx-auto mb-6 flex w-fit rounded-2xl bg-muted p-6">
        <GuildEmblem className="h-20 w-20 text-muted-foreground" />
      </div>
      <h1
        className="text-2xl font-bold text-foreground"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Invitation not found
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
        This invite link is invalid or has expired. Ask a guild member for a
        fresh one.
      </p>
      <Button asChild className="mt-8 w-full">
        {isAuthenticated ? (
          <Link to="/">Back to your quests</Link>
        ) : (
          <Link to="/login">Go to sign in</Link>
        )}
      </Button>
    </InviteCard>
  )
}

// ─── Estados 2 y 3: tarjeta de previsualización (autenticado o no) ─────────────

function InvitePreviewCard({
  code,
  preview,
  isAuthenticated,
}: {
  code: string
  preview: GuildInvitePreview
  isAuthenticated: boolean
}) {
  const extraCount = Math.max(0, preview.memberCount - preview.members.length)

  return (
    <InviteCard>
      <div className="mx-auto mb-6 flex w-fit rounded-2xl bg-primary/5 p-6">
        <GuildEmblem className="h-20 w-20 text-primary" />
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        You&apos;ve been invited to join
      </p>
      <h1
        className="mt-1 text-3xl font-bold text-foreground"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {preview.name}
      </h1>

      {preview.description && (
        <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
          {preview.description}
        </p>
      )}

      {/* Pila de avatares + recuento de miembros */}
      {preview.memberCount > 0 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          {preview.members.length > 0 && (
            <AvatarGroup>
              {preview.members.map((member, index) => (
                <Avatar key={index}>
                  {member.image && <AvatarImage src={member.image} alt="" />}
                  <AvatarFallback>{member.initials}</AvatarFallback>
                </Avatar>
              ))}
              {extraCount > 0 && (
                <AvatarGroupCount>+{extraCount}</AvatarGroupCount>
              )}
            </AvatarGroup>
          )}
          <p className="text-sm text-muted-foreground">
            {preview.memberCount} adventurer
            {preview.memberCount !== 1 ? 's' : ''} already here
          </p>
        </div>
      )}

      <div className="mt-8">
        {isAuthenticated ? (
          <JoinCta code={code} guildName={preview.name} />
        ) : (
          <GuestCta code={code} />
        )}
      </div>
    </InviteCard>
  )
}

// Estado 3: visitante autenticado que aún no es miembro — unirse explícitamente
function JoinCta({ code, guildName }: { code: string; guildName: string }) {
  const joinGuild = useJoinGuild()

  return (
    <div className="space-y-4">
      {joinGuild.isError && (
        <p role="alert" className="text-sm text-destructive">
          Could not join the guild. Please try again.
        </p>
      )}
      <Button
        type="button"
        onClick={() => joinGuild.mutate(code)}
        disabled={joinGuild.isPending}
        className="w-full border-0 bg-linear-to-br from-(--lagoon) to-(--palm) text-white shadow-md shadow-(--lagoon)/20 transition-opacity hover:opacity-90"
      >
        {joinGuild.isPending ? 'Joining…' : `Join ${guildName}`}
      </Button>
      <Link
        to="/"
        className="block text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Maybe later
      </Link>
    </div>
  )
}

// Estado 2: visitante sin sesión — iniciar sesión o registrarse y volver aquí
function GuestCta({ code }: { code: string }) {
  // Tras autenticarse, el usuario vuelve a esta misma pantalla de invitación
  const redirect = `/invite/${code}`

  return (
    <div className="space-y-4">
      <Button
        asChild
        className="w-full border-0 bg-linear-to-br from-(--lagoon) to-(--palm) text-white shadow-md shadow-(--lagoon)/20 transition-opacity hover:opacity-90"
      >
        <Link to="/login" search={{ redirect }}>
          Sign in to join
        </Link>
      </Button>
      <p className="text-sm text-muted-foreground">
        New to Questlog?{' '}
        <Link
          to="/register"
          search={{ redirect }}
          className="font-medium text-(--lagoon-deep) underline-offset-4 transition-colors hover:underline dark:text-(--lagoon)"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}
