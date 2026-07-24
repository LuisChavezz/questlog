/**
 * QuestsTable — tabla de quests conectada a TanStack Query.
 * Obtiene los datos vía server function, los muestra en el DataTable reutilizable
 * y permite edición inline campo a campo.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ColumnFiltersState, Row } from '@tanstack/react-table'
import { Activity, Flag, Swords, Trash2 } from 'lucide-react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { DataTable } from '#/components/ui/data-table'
import type { DataTableBulkAction } from '#/components/ui/data-table-bulk-actions'
import type { Quest, QuestPriority, QuestStatus, GuildRole } from '#/db/schema'
import {
  questGuildsQueryOptions,
  questsQueryOptions,
  QUEST_GUILDS_QUERY_KEY,
  QUESTS_QUERY_KEY,
} from '../api/quests-query-options'
import { invalidateGuildQuestCaches } from '../api/invalidate-guild-quest-caches'
import type { UpdateQuestValues } from '../schemas/quest-schemas'
import { useBulkDeleteQuests } from '../hooks/use-bulk-delete-quests'
import { useBulkUpdateQuests } from '../hooks/use-bulk-update-quests'
import { useDeleteQuest } from '../hooks/use-delete-quest'
import { useUpdateQuest } from '../hooks/use-update-quest'
import { useQuestsColumnsGuildContext } from '../hooks/use-quests-columns-guild-context'
import {
  createAssigneeFilterDef,
  createQuestsColumns,
  createSupervisorFilterDef,
  DUE_DATE_FILTER,
  PRIORITY_OPTIONS,
  QUEST_FILTERS,
  QUEST_TABLE_STICKY_LEADING_COLUMN_IDS,
  STATUS_OPTIONS,
} from './quests-columns'
import type { MemberOption } from './member-select'
import { CreateQuestDialog } from './create-quest-dialog'
import { QuestDetailsDrawer } from './quest-details-drawer'
import { QuestsSection } from './quests-section'

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
  /**
   * Caché sobre la que operan las mutaciones. Por defecto la que corresponde al
   * contexto: la del guild si la tabla vive en uno, o la personal.
   *
   * `/quests` la fija a `QUESTS_QUERY_KEY` en TODAS sus tablas —también en las
   * de guild— porque ahí las secciones son particiones de una única query, no
   * queries independientes: sin esto, editar una quest desde la sección de un
   * guild parchearía optimistamente la caché de la página de ESE guild y la
   * fila de la tabla que el usuario está mirando no se movería.
   */
  questsQueryKey?: QueryKey
  /**
   * Filtros de columna con los que la tabla debe arrancar — p. ej. el Status
   * precargado desde el search param `?status=...` al llegar desde un stat
   * card de Guild Overview. Pasa a `DataTable` tal cual: solo semilla el
   * `columnFilters` inicial, ver su prop `initialColumnFilters`.
   */
  initialColumnFilters?: ColumnFiltersState
}

// Componente presentacional reutilizable — acepta quests como prop para que
// distintas rutas (personal, guild) puedan alimentarlo con su propia query.
export function QuestsTableContent({
  quests,
  actions,
  guildContext,
  questsQueryKey,
  initialColumnFilters,
}: QuestsTableContentProps) {
  const queryClient = useQueryClient()
  // Caché de quests sobre la que operan las mutaciones: la que fije el caller
  // o, si no, la del guild cuando la tabla vive en uno y la personal en el resto.
  const mutationsQueryKey =
    questsQueryKey ??
    (guildContext
      ? (['guild', guildContext.slug, 'quests'] as QueryKey)
      : QUESTS_QUERY_KEY)

  // Cualquier cambio sobre una quest de guild (título, estado, prioridad, tags,
  // fecha, asignado o supervisor) actualiza `quests.updated_at`, que es justo lo
  // que ordena la actividad reciente de Overview — así que TODA mutación de
  // quest invalida `['guild', slug]` además de la lista, no solo borrado/estado.
  const guildSlug = guildContext?.slug
  // La lista personal muestra quests de guild (las que el usuario creó o
  // supervisa), así que editar una desde la página de un guild también la deja
  // obsoleta. Se omite cuando el caller fijó `questsQueryKey` explícitamente:
  // hoy solo lo hacen las secciones de `/quests` (que la fijan justo a la
  // personal), y ahí el propio hook de mutación ya la invalida. Se mira la
  // prop (la señal directa de esa intención), no la forma de la clave
  // resuelta, que rompería en silencio si `QUESTS_QUERY_KEY` cambiara.
  const invalidatesPersonalQuests = questsQueryKey === undefined
  const invalidateRelatedCaches = useCallback(() => {
    if (!guildSlug) return

    invalidateGuildQuestCaches(queryClient, guildSlug, {
      includePersonalQuests: invalidatesPersonalQuests,
    })
  }, [queryClient, guildSlug, invalidatesPersonalQuests])

  // Edición inline de campos: en un guild opera sobre su caché de quests para
  // que el cambio se refleje en la vista; fuera de un guild, sobre la personal.
  // Envuelta para invalidar también el detalle del guild en cada edición exitosa.
  const { mutate: updateQuestMutation } = useUpdateQuest(mutationsQueryKey)
  const updateQuest = useCallback(
    (data: UpdateQuestValues) => {
      updateQuestMutation(data, { onSuccess: invalidateRelatedCaches })
    },
    [updateQuestMutation, invalidateRelatedCaches],
  )
  const { mutateAsync: bulkUpdateQuests, isPending: isBulkUpdating } =
    useBulkUpdateQuests(mutationsQueryKey)
  const { mutateAsync: bulkDeleteQuests } =
    useBulkDeleteQuests(mutationsQueryKey)
  const { mutateAsync: deleteQuest } = useDeleteQuest(mutationsQueryKey)

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

    invalidateRelatedCaches()
    clearSelection()
  }

  // Contexto de columnas (miembros + reasignación + permisos por quest) derivado
  // del contexto de guild de la tabla — hook compartido con el host del drawer
  // del Overview, para no reimplementar el ensamblado de permisos dos veces.
  const guildMembers = guildContext?.members
  const columnsGuildContext = useQuestsColumnsGuildContext(
    guildContext,
    updateQuest,
  )

  const columns = useMemo(
    () =>
      createQuestsColumns(updateQuest, columnsGuildContext, (quest) =>
        setDetailsQuestId(quest.id),
      ),
    [updateQuest, columnsGuildContext],
  )

  // Orden de los filtros = orden de las columnas de la tabla: Status, Priority,
  // [Assignee, Supervisor si hay guild], Due date. Assignee/Supervisor solo son
  // filtrables con contexto de guild (sus opciones son los miembros reales, que
  // la vista personal no tiene); "Due date" (Overdue) aplica en ambas vistas y
  // va al final, como su columna.
  const questFilters = useMemo(
    () =>
      guildMembers
        ? [
            ...QUEST_FILTERS,
            createAssigneeFilterDef(guildMembers),
            createSupervisorFilterDef(guildMembers),
            DUE_DATE_FILTER,
          ]
        : [...QUEST_FILTERS, DUE_DATE_FILTER],
    [guildMembers],
  )

  // Solo se pueden seleccionar (para acciones masivas) las quests gestionables.
  // En la vista personal (sin contexto de guild) se seleccionan todas.
  const enableRowSelection = columnsGuildContext
    ? (row: Row<Quest>) => columnsGuildContext.canManageQuest(row.original)
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
          invalidateRelatedCaches()
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
          invalidateRelatedCaches()
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
    [bulkUpdateQuests, isBulkUpdating, invalidateRelatedCaches],
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
        // Como datos: `DataTable` renderiza la barra de filtros por su cuenta
        // y decide toggle/fila/gap mirando `filters.length` — con lista vacía
        // no aparece nada, sin que este caller tenga que gatearlo a mano.
        filters={questFilters}
        initialColumnFilters={initialColumnFilters}
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

/**
 * QuestsTable — la lista personal (`/quests`), que reúne las quests propias y
 * las de guild donde el usuario es creador o supervisor.
 *
 * Una tabla INDEPENDIENTE por origen: la personal y una por guild. No es una
 * sola tabla con secciones porque Assignee/Supervisor tienen alcance de guild —
 * cada guild tiene su propio roster, y un único desplegable "Assignee" que
 * mezclara personas de varios guilds sería ambiguo (dos miembros de guilds
 * distintos pueden llamarse igual) además de ofrecer filtros que no aplican a
 * la mayoría de las filas. Separando las tablas, cada toolbar ofrece exactamente
 * las opciones válidas para sus filas, y filtros, orden, paginación y selección
 * quedan acotados a un solo origen sin lógica extra.
 *
 * Los datos, en cambio, SÍ vienen de una sola query (`['quests']`) que se
 * particiona en cliente: N round-trips por guild no aportarían nada —la
 * consulta ya trae todo— y romperían el array plano de `Quest` sobre el que
 * operan las actualizaciones optimistas de los hooks de mutación.
 */
export function QuestsTable({ currentUserId }: { currentUserId: string }) {
  // useSuspenseQuery garantiza que los datos estén disponibles antes de renderizar.
  // El Suspense boundary en QuestsPage muestra el skeleton mientras carga.
  const { data: quests } = useSuspenseQuery(questsQueryOptions)
  const { data: questGuilds } = useSuspenseQuery(questGuildsQueryOptions)
  const queryClient = useQueryClient()

  const { personalQuests, questsByGuildId } = useMemo(() => {
    const personal: Quest[] = []
    const byGuildId = new Map<string, Quest[]>()

    for (const quest of quests) {
      if (!quest.guildId) {
        personal.push(quest)
        continue
      }

      const guildQuests = byGuildId.get(quest.guildId) ?? []
      guildQuests.push(quest)
      byGuildId.set(quest.guildId, guildQuests)
    }

    return { personalQuests: personal, questsByGuildId: byGuildId }
  }, [quests])

  // Las quests y los guilds son dos cachés con su propio ciclo de vida, así que
  // `['quests']` puede refrescarse antes y traer una quest de un guild que
  // `['quest-guilds']` todavía no conoce (p. ej. acaban de nombrarte supervisor
  // en un guild donde no tenías ninguna). Sin roster no hay sección donde
  // pintarla, y la quest quedaría invisible hasta que esa caché caducara: en vez
  // de esperar, se refresca en cuanto se detecta. El ref evita repetir la
  // petición para el mismo conjunto de ids MIENTRAS siga sin resolverse — en
  // cuanto el conjunto queda vacío (el roster ya se puso al día) se olvida, así
  // que si el MISMO guild vuelve a faltar más adelante (una incidencia nueva,
  // no la misma sin resolver) se detecta y refresca de nuevo en vez de darse
  // por ya intentada para siempre.
  const refreshedGuildIdsRef = useRef<string | null>(null)
  useEffect(() => {
    const knownGuildIds = new Set(questGuilds.map((guild) => guild.id))
    const missingGuildIds = [...questsByGuildId.keys()]
      .filter((guildId) => !knownGuildIds.has(guildId))
      .sort()
      .join(',')

    if (!missingGuildIds) {
      refreshedGuildIdsRef.current = null
      return
    }

    if (refreshedGuildIdsRef.current === missingGuildIds) {
      return
    }

    refreshedGuildIdsRef.current = missingGuildIds
    queryClient.invalidateQueries({ queryKey: QUEST_GUILDS_QUERY_KEY })
  }, [questGuilds, questsByGuildId, queryClient])

  return (
    <div className="flex flex-col gap-8">
      {/* La sección personal se pinta siempre, aunque esté vacía: es donde vive
          el botón de crear una quest personal. */}
      <QuestsSection label="Personal" count={personalQuests.length}>
        <QuestsTableContent
          quests={personalQuests}
          questsQueryKey={QUESTS_QUERY_KEY}
          actions={<CreateQuestDialog />}
        />
      </QuestsSection>

      {questGuilds.map((guild) => {
        const guildQuests = questsByGuildId.get(guild.id)

        // `getQuestGuilds` solo devuelve guilds con quests visibles, así que
        // esto solo se da con una caché de quests más fresca que la de guilds.
        if (!guildQuests?.length) return null

        return (
          <QuestsSection
            key={guild.id}
            label={
              <span className="inline-flex items-center gap-1.5">
                <Swords
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                {guild.name}
              </span>
            }
            count={guildQuests.length}
          >
            <QuestsTableContent
              quests={guildQuests}
              questsQueryKey={QUESTS_QUERY_KEY}
              guildContext={{
                slug: guild.slug,
                members: guild.members,
                currentUserId,
                currentUserRole: guild.currentUserRole,
                guildOwnerId: guild.ownerId,
              }}
            />
          </QuestsSection>
        )
      })}
    </div>
  )
}
