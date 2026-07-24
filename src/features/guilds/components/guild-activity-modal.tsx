/**
 * GuildActivityModal — historial completo y paginado de la actividad de un guild
 * (se abre desde "View all" en la tarjeta del Overview). Reutiliza el MISMO
 * `ActivityLogEntry` que la tarjeta, y pagina con "Load more" hasta agotar el
 * historial (`hasNextPage`, derivado de `hasMore` del servidor).
 *
 * A diferencia de la tarjeta, aquí el título de cada quest NO abre el drawer de
 * detalle (se omite `onOpenQuest`): dentro del modal se renderiza como texto
 * plano, sin ninguna afordancia de clic.
 */
import { useInfiniteQuery } from '@tanstack/react-query'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import type { MemberOption } from '#/features/quests/components/member-select'
import { guildActivityHistoryInfiniteQueryOptions } from '../api/guild-query-options'
import { ActivityLogEntry } from './activity-log-entry'

export function GuildActivityModal({
  slug,
  members,
  open,
  onOpenChange,
}: {
  slug: string
  members: MemberOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...guildActivityHistoryInfiniteQueryOptions(slug),
    // No pedir el historial hasta que el modal se abre — el Overview no lo
    // precarga (a diferencia de la actividad reciente de la tarjeta).
    enabled: open,
  })

  const entries = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-6 pb-4">
          <DialogTitle>Activity</DialogTitle>
          <DialogDescription>
            Full history of changes to this guild&apos;s quests.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity…</p>
          ) : isError ? (
            <p className="text-sm text-muted-foreground">
              Failed to load activity.
            </p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {entries.map((entry) => (
                <ActivityLogEntry key={entry.id} entry={entry} members={members} />
              ))}

              {/* "Load more" solo mientras queden páginas (hasNextPage deriva de
                  `hasMore`); al agotarse, desaparece. */}
              {hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-center"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
