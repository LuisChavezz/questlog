/**
 * useGuildActivityDrawer — aloja el MISMO QuestDetailsDrawer que la tabla de
 * quests, pero para el Overview: la tarjeta y el modal de actividad enlazan a él
 * vía `openQuest`. Reutiliza el mecanismo de apertura existente (estado por id +
 * QuestDetailsDrawer) y el ensamblado de permisos de guild
 * (`useQuestsColumnsGuildContext`), en vez de construir un drawer nuevo.
 */
import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { QuestDetailsDrawer } from '#/features/quests/components/quest-details-drawer'
import { useQuestsColumnsGuildContext } from '#/features/quests/hooks/use-quests-columns-guild-context'
import { useUpdateQuest } from '#/features/quests/hooks/use-update-quest'
import { invalidateGuildQuestCaches } from '#/features/quests/api/invalidate-guild-quest-caches'
import type { UpdateQuestValues } from '#/features/quests/schemas/quest-schemas'
import { guildQuestsQueryOptions } from '../api/guild-query-options'
import type { GuildDetail } from '../api/get-guild'

export function useGuildActivityDrawer(
  slug: string,
  currentUserId: string,
  guild: GuildDetail | undefined,
) {
  const queryClient = useQueryClient()
  // Lista completa de quests del guild: el drawer necesita el objeto `Quest`
  // vigente (con ediciones optimistas), resuelto por id. Precargada en el loader
  // de la ruta, así que aquí sale de caché.
  const { data: quests } = useQuery(guildQuestsQueryOptions(slug))

  // Edición inline desde el drawer sobre la caché de quests del guild. El Overview
  // es la página del guild, así que al editar aquí hay que invalidar tanto el
  // detalle/actividad del guild (`['guild', slug]`) como la lista personal de
  // quests (`['quests']`), que puede mostrar esta misma quest (creador/supervisor/
  // asignado). Se reutiliza el MISMO invalidador que la tabla de quests
  // (`invalidateRelatedCaches` con `includePersonalQuests`) para no divergir.
  const { mutate: updateQuestMutation } = useUpdateQuest([
    'guild',
    slug,
    'quests',
  ])
  const updateQuest = useCallback(
    (data: UpdateQuestValues) => {
      updateQuestMutation(data, {
        onSuccess: () =>
          invalidateGuildQuestCaches(queryClient, slug, {
            includePersonalQuests: true,
          }),
      })
    },
    [updateQuestMutation, queryClient, slug],
  )

  const columnsGuildContext = useQuestsColumnsGuildContext(
    guild
      ? {
          slug,
          members: guild.members,
          currentUserId,
          currentUserRole: guild.currentUserRole,
          guildOwnerId: guild.guild.ownerId,
        }
      : undefined,
    updateQuest,
  )

  // Solo el id abierto —no la quest— para que el drawer siempre lea el objeto
  // vigente de la lista (incluidas ediciones optimistas), igual que la tabla.
  const [detailsQuestId, setDetailsQuestId] = useState<string | null>(null)
  const detailsQuest =
    (quests ?? []).find((quest) => quest.id === detailsQuestId) ?? null

  const openQuest = useCallback((questId: string) => {
    setDetailsQuestId(questId)
  }, [])

  const drawer = (
    <QuestDetailsDrawer
      quest={detailsQuest}
      onOpenChange={(open) => {
        if (!open) setDetailsQuestId(null)
      }}
      onUpdate={updateQuest}
      guildContext={columnsGuildContext}
    />
  )

  return { openQuest, drawer }
}
