import { createFileRoute, redirect } from '@tanstack/react-router'

import { getGuildInvitePreview } from '#/features/guilds/api/get-guild-invite-preview'
import { GuildInvite } from '#/features/guilds/components/guild-invite'
import type { GuildInviteData } from '#/features/guilds/components/guild-invite'

// Ruta PÚBLICA fuera de _app y _auth: funciona con o sin sesión activa.
export const Route = createFileRoute('/invite/$code')({
  loader: async ({ params }): Promise<GuildInviteData> => {
    const result = await getGuildInvitePreview({ data: { code: params.code } })

    // Código inválido/expirado → pantalla de error (sin filtrar datos del guild)
    if (!result.guild) {
      return { kind: 'invalid', isAuthenticated: result.viewer.isAuthenticated }
    }

    // Ya es miembro → redirección inmediata, sin flash de la invitación
    if (result.viewer.isMember) {
      throw redirect({
        to: '/guilds/$slug',
        params: { slug: result.guild.slug },
      })
    }

    return {
      kind: 'preview',
      isAuthenticated: result.viewer.isAuthenticated,
      preview: result.guild,
    }
  },
  component: InviteRoute,
})

function InviteRoute() {
  const { code } = Route.useParams()
  const data = Route.useLoaderData()
  return <GuildInvite code={code} data={data} />
}
