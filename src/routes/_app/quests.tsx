import { createFileRoute } from '@tanstack/react-router'

import {
  questGuildsQueryOptions,
  questsQueryOptions,
} from '#/features/quests/api/quests-query-options'
import { QuestsPage } from '#/features/quests/components/quests-page'

export const Route = createFileRoute('/_app/quests')({
  // Pre-carga en el servidor las dos queries que consume la página: las quests
  // (que se particionan en una tabla por origen) y los guilds con su roster
  // (nombre de cada sección + opciones de asignado/supervisor de su tabla).
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(questsQueryOptions),
      queryClient.ensureQueryData(questGuildsQueryOptions),
    ]),
  component: QuestsRoute,
})

function QuestsRoute() {
  // La sesión está garantizada por el guard de _app; da el id del usuario actual
  const { session } = Route.useRouteContext()

  return <QuestsPage currentUserId={session.user.id} />
}
