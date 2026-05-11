import { createFileRoute } from '@tanstack/react-router'

import { questsQueryOptions } from '#/features/quests/api/quests-query-options'
import { QuestsPage } from '#/features/quests/components/quests-page'

export const Route = createFileRoute('/_app/quests')({
  // Pre-carga las quests en el servidor antes de enviar el HTML al cliente
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(questsQueryOptions),
  component: QuestsPage,
})
