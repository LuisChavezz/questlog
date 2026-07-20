/**
 * QuestsTable — tabla de quests conectada a TanStack Query.
 * Obtiene los datos vía server function, los muestra en el DataTable reutilizable
 * y permite edición inline campo a campo.
 */
import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Row } from '@tanstack/react-table'
import { Activity, Flag, Trash2 } from 'lucide-react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'

import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { DataTable } from '#/components/ui/data-table'
import type { DataTableBulkAction } from '#/components/ui/data-table-bulk-actions'
import type { Quest, QuestPriority, QuestStatus, GuildRole } from '#/db/schema'
import {
  canManageGuildQuest,
  canUpdateGuildQuestStatus,
} from '#/features/guilds/role-labels'
import type { GuildMemberViewer } from '#/features/guilds/role-labels'
import { questsQueryOptions } from '../api/quests-query-options'
import type { UpdateQuestValues } from '../schemas/quest-schemas'
import { useBulkDeleteQuests } from '../hooks/use-bulk-delete-quests'
import { useBulkUpdateQuests } from '../hooks/use-bulk-update-quests'
import { useDeleteQuest } from '../hooks/use-delete-quest'
import { useUpdateQuest } from '../hooks/use-update-quest'
import {
  createQuestsColumns,
  PRIORITY_OPTIONS,
  QUEST_TABLE_STICKY_LEADING_COLUMN_IDS,
  STATUS_OPTIONS,
} from './quests-columns'
import type { MemberOption } from './member-select'
import { CreateQuestDialog } from './create-quest-dialog'
import { QuestDetailsDrawer } from './quest-details-drawer'

// Estado de la eliminación pendiente de confirmación en el diálogo
interface PendingDeletion {
  ids: string[]
  clearSelection: () => void
}

// Miembro del guild con su rol — el rol es necesario para resolver los permisos
// de gestión por quest (un Officer solo gestiona quests de rango inferior).
export interface GuildQuestTableMember extends MemberOption {
  role: GuildRole
}

// Contexto de guild para la tabla: activa las columnas de asignado/supervisor y
// su edición inline, y aporta lo necesario para autorizar cada acción. Se omite
// en la vista personal de quests.
export interface QuestsTableGuildContext {
  slug: string
  members: GuildQuestTableMember[]
  currentUserId: string
  currentUserRole: GuildRole
  // Dueño estructural del guild (guilds.owner_id) — para identificar al Guild Master
  guildOwnerId: string
}

interface QuestsTableContentProps {
  quests: Quest[]
  actions?: ReactNode
  guildContext?: QuestsTableGuildContext
}

// Componente presentacional reutilizable — acepta quests como prop para que
// distintas rutas (personal, guild) puedan alimentarlo con su propia query.
export function QuestsTableContent({
  quests,
  actions,
  guildContext,
}: QuestsTableContentProps) {
  const queryClient = useQueryClient()
  // Caché de quests sobre la que operan las mutaciones: la del guild si la
  // tabla vive ahí, o la personal por defecto.
  const questsQueryKey = guildContext
    ? (['guild', guildContext.slug, 'quests'] as const)
    : (['quests'] as const)

  // Cualquier cambio sobre una quest de guild (título, estado, prioridad, tags,
  // fecha, asignado o supervisor) actualiza `quests.updated_at`, que es justo lo
  // que ordena la actividad reciente de Overview — así que TODA mutación de
  // quest invalida `['guild', slug]` además de la lista, no solo borrado/estado.
  const guildSlug = guildContext?.slug
  const invalidateGuildDetail = useCallback(() => {
    if (!guildSlug) return
    queryClient.invalidateQueries({ queryKey: ['guild', guildSlug] })
  }, [queryClient, guildSlug])

  // Edición inline de campos: en un guild opera sobre su caché de quests para
  // que el cambio se refleje en la vista; fuera de un guild, sobre la personal.
  // Envuelta para invalidar también el detalle del guild en cada edición exitosa.
  const { mutate: updateQuestMutation } = useUpdateQuest(questsQueryKey)
  const updateQuest = useCallback(
    (data: UpdateQuestValues) => {
      updateQuestMutation(data, { onSuccess: invalidateGuildDetail })
    },
    [updateQuestMutation, invalidateGuildDetail],
  )
  const { mutateAsync: bulkUpdateQuests, isPending: isBulkUpdating } =
    useBulkUpdateQuests(questsQueryKey)
  const { mutateAsync: bulkDeleteQuests } = useBulkDeleteQuests(questsQueryKey)
  const { mutateAsync: deleteQuest } = useDeleteQuest(questsQueryKey)
  // Reasignar asignado/supervisor es solo otra edición de campo: se enruta por
  // el mismo `updateQuest` (misma caché optimista y misma invalidación del
  // detalle del guild) en vez de un hook aparte que reimplemente el patrón.
  const updateAssignment = useCallback(
    (input: {
      id: string
      field: 'assigneeId' | 'supervisorId'
      userId: string | null
    }) => {
      updateQuest({ id: input.id, [input.field]: input.userId })
    },
    [updateQuest],
  )

  // Eliminación seleccionada pendiente de confirmación (null = diálogo cerrado)
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null)
  const pendingCount = pendingDeletion?.ids.length ?? 0

  // Id de la quest cuyo drawer de detalle está abierto (null = cerrado). Se
  // guarda solo el id —no la quest completa— para que el contenido del drawer
  // siempre lea el objeto vigente de `quests` (incluye ediciones optimistas)
  // en vez de quedarse con una copia obsoleta tomada al abrir.
  const [detailsQuestId, setDetailsQuestId] = useState<string | null>(null)
  const detailsQuest =
    quests.find((quest) => quest.id === detailsQuestId) ?? null

  // Ejecuta la eliminación: usa el endpoint individual para una sola quest
  // y el masivo para varias, luego limpia la selección de la tabla
  const confirmDeletion = async () => {
    if (!pendingDeletion) return

    const { ids, clearSelection } = pendingDeletion

    if (ids.length === 1) {
      await deleteQuest({ id: ids[0] })
    } else {
      await bulkDeleteQuests({ ids })
    }

    invalidateGuildDetail()
    clearSelection()
  }

  // Memoizar columnas para evitar recreaciones innecesarias.
  // updateQuest y updateAssignment de useMutation son referencias estables;
  // los campos del guild provienen de la query y son estables entre renders.
  const guildMembers = guildContext?.members
  const guildCurrentUserId = guildContext?.currentUserId
  const guildCurrentUserRole = guildContext?.currentUserRole
  const guildOwnerId = guildContext?.guildOwnerId

  // Predicados de permiso derivados del contexto de guild — misma lógica de dos
  // ejes que el servidor (role-labels). El rol del creador de cada quest se
  // resuelve contra los miembros del guild.
  const guildAuth = useMemo(() => {
    if (
      !guildMembers ||
      !guildCurrentUserId ||
      !guildCurrentUserRole ||
      !guildOwnerId
    ) {
      return null
    }

    const viewer: GuildMemberViewer = {
      viewerId: guildCurrentUserId,
      viewerRole: guildCurrentUserRole,
      ownerId: guildOwnerId,
    }
    const roleByUserId = new Map(guildMembers.map((m) => [m.userId, m.role]))
    const targetOf = (quest: Quest) => ({
      creatorId: quest.ownerId,
      creatorRole: roleByUserId.get(quest.ownerId) ?? null,
      assigneeId: quest.assigneeId,
      supervisorId: quest.supervisorId,
    })

    return {
      canManageQuest: (quest: Quest) =>
        canManageGuildQuest(viewer, targetOf(quest)),
      canUpdateQuestStatus: (quest: Quest) =>
        canUpdateGuildQuestStatus(viewer, targetOf(quest)),
    }
  }, [guildMembers, guildCurrentUserId, guildCurrentUserRole, guildOwnerId])

  const columnsGuildContext = useMemo(
    () =>
      guildMembers && guildAuth
        ? {
            members: guildMembers,
            onAssignmentChange: updateAssignment,
            canManageQuest: guildAuth.canManageQuest,
            canUpdateQuestStatus: guildAuth.canUpdateQuestStatus,
          }
        : undefined,
    [guildMembers, guildAuth, updateAssignment],
  )

  const columns = useMemo(
    () =>
      createQuestsColumns(updateQuest, columnsGuildContext, (quest) =>
        setDetailsQuestId(quest.id),
      ),
    [updateQuest, columnsGuildContext],
  )

  // Solo se pueden seleccionar (para acciones masivas) las quests gestionables.
  // En la vista personal (sin guildAuth) se seleccionan todas.
  const enableRowSelection = guildAuth
    ? (row: Row<Quest>) => guildAuth.canManageQuest(row.original)
    : true
  const bulkActions = useMemo<DataTableBulkAction<Quest>[]>(
    () => [
      {
        id: 'status',
        kind: 'menu',
        label: 'Change Status',
        icon: Activity,
        options: STATUS_OPTIONS.map(({ value, label, icon }) => ({
          value,
          label,
          icon,
        })),
        disabled: isBulkUpdating,
        onSelect: async (value, { items }) => {
          await bulkUpdateQuests({
            ids: items.map((quest) => quest.id),
            status: value as QuestStatus,
          })
          invalidateGuildDetail()
        },
      },
      {
        id: 'priority',
        kind: 'menu',
        label: 'Change Priority',
        icon: Flag,
        options: PRIORITY_OPTIONS.map(({ value, label, icon }) => ({
          value,
          label,
          icon,
        })),
        disabled: isBulkUpdating,
        onSelect: async (value, { items }) => {
          await bulkUpdateQuests({
            ids: items.map((quest) => quest.id),
            priority: value as QuestPriority,
          })
          invalidateGuildDetail()
        },
      },
      {
        // Botón solo-icono que abre el diálogo de confirmación (una o varias quests)
        id: 'delete',
        kind: 'custom',
        render: ({ items, clearSelection }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete selected quests"
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setPendingDeletion({
                ids: items.map((quest) => quest.id),
                clearSelection,
              })
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        ),
      },
    ],
    [bulkUpdateQuests, isBulkUpdating, invalidateGuildDetail],
  )

  return (
    <>
      <DataTable
        bulkActions={bulkActions}
        columns={columns}
        data={quests}
        getRowId={(quest) => quest.id}
        enableRowSelection={enableRowSelection}
        filterPlaceholder="Search quests..."
        defaultPageSize={10}
        actions={actions}
        stickyLeadingColumnIds={QUEST_TABLE_STICKY_LEADING_COLUMN_IDS}
      />

      <ConfirmDialog
        open={pendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null)
        }}
        variant="destructive"
        title={pendingCount === 1 ? 'Delete quest?' : 'Delete quests?'}
        description={
          pendingCount === 1
            ? 'This quest will be permanently deleted. This action cannot be undone.'
            : `These ${pendingCount} quests will be permanently deleted. This action cannot be undone.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeletion}
      />

      <QuestDetailsDrawer
        quest={detailsQuest}
        onOpenChange={(open) => {
          if (!open) setDetailsQuestId(null)
        }}
        onUpdate={updateQuest}
        guildContext={columnsGuildContext}
      />
    </>
  )
}

export function QuestsTable() {
  // useSuspenseQuery garantiza que los datos estén disponibles antes de renderizar.
  // El Suspense boundary en QuestsPage muestra el skeleton mientras carga.
  const { data: quests } = useSuspenseQuery(questsQueryOptions)
  return <QuestsTableContent quests={quests} actions={<CreateQuestDialog />} />
}
