/**
 * QuestDetailsDrawer — panel lateral (Notion-style) con la vista expandida de
 * una quest. Reutiliza los mismos editores inline que la tabla, así que
 * editar aquí o en la fila mantiene la misma caché optimista sincronizada.
 * Los comentarios quedan explícitamente fuera de alcance: la sección al pie
 * solo reserva el layout para no tener que reestructurar cuando se agreguen.
 */
import {
  Activity,
  Calendar,
  Clock,
  Eye,
  Flag,
  MessageSquare,
  ScrollText,
  Tag,
  UserRound,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import type { Quest } from '#/db/schema'
import { dateFormatter } from '#/lib/format-date'
import type { UpdateQuestValues } from '../schemas/quest-schemas'
import {
  getQuestPermissions,
  PRIORITY_OPTIONS,
  QUEST_OPEN_TRIGGER_ATTR,
  STATUS_OPTIONS,
} from './quests-columns'
import type { QuestsColumnsGuildContext } from './quests-columns'
import { InlineEditBadge } from './inline-edit-badge'
import { InlineEditDescription } from './inline-edit-description'
import { InlineEditDueDate } from './inline-edit-due-date'
import { InlineEditTags } from './inline-edit-tags'
import { InlineEditTitle } from './inline-edit-title'
import { MemberDisplay, MemberSelect } from './member-select'

interface QuestDetailsDrawerProps {
  /** Quest a mostrar. `null` mantiene el Sheet cerrado. */
  quest: Quest | null
  onOpenChange: (open: boolean) => void
  onUpdate: (data: UpdateQuestValues) => void
  /** Si se provee, habilita la edición de asignado/supervisor y los predicados de permiso del guild. */
  guildContext?: QuestsColumnsGuildContext
}

function DetailField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
        {label}
      </span>
      {children}
    </div>
  )
}

export function QuestDetailsDrawer({
  quest,
  onOpenChange,
  onUpdate,
  guildContext,
}: QuestDetailsDrawerProps) {
  const { canManage, canEditStatus } = getQuestPermissions(guildContext)

  return (
    // `modal={false}` + overlay no bloqueante: el drawer convive con la tabla
    // en vez de bloquearla, así que el trigger de otra fila sigue siendo
    // clickeable con el drawer abierto y cambia de quest sin cerrar primero.
    <Sheet open={quest !== null} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="sm:max-w-sm"
        // Radix trata el clic en el trigger "Open" de OTRA fila como un clic
        // externo y lo usaría para cerrar el drawer antes de que ese mismo
        // clic lo reabra con la nueva quest (parpadeo cierra→abre). Los
        // triggers marcan `QUEST_OPEN_TRIGGER_ATTR`; si el pointerdown cae en
        // uno de ellos, se cancela el cierre y el contenido se intercambia en
        // el sitio en vez de cerrar y reabrir.
        onPointerDownOutside={(event) => {
          const target = event.target
          if (target instanceof Element && target.closest(`[${QUEST_OPEN_TRIGGER_ATTR}]`)) {
            event.preventDefault()
          }
        }}
      >
        {quest && (
          <QuestDetailsContent
            quest={quest}
            onUpdate={onUpdate}
            guildContext={guildContext}
            canManage={canManage(quest)}
            canEditStatus={canEditStatus(quest)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function QuestDetailsContent({
  quest,
  onUpdate,
  guildContext,
  canManage,
  canEditStatus,
}: {
  quest: Quest
  onUpdate: (data: UpdateQuestValues) => void
  guildContext?: QuestsColumnsGuildContext
  canManage: boolean
  canEditStatus: boolean
}) {
  const assignee = guildContext?.members.find((m) => m.userId === quest.assigneeId)
  const supervisor = guildContext?.members.find(
    (m) => m.userId === quest.supervisorId,
  )

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="pr-12">
        {/* Título accesible para el Dialog (sr-only); la afordancia visible e
            interactiva es InlineEditTitle, que cambia de elemento raíz según
            el modo (botón/input/span) y por eso no puede vivir dentro de
            SheetTitle asChild. El pr-12 del header (en vez de solo padding
            interno del input) es lo que deja un espacio real entre el borde
            del input y el botón de cerrar — el padding interno no mueve el
            borde, solo el texto. */}
        <SheetTitle className="sr-only">{quest.title}</SheetTitle>
        <InlineEditTitle
          value={quest.title}
          onSave={(title) => onUpdate({ id: quest.id, title })}
          readOnly={!canManage}
          className="text-base"
        />
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-6">
          <DetailField icon={ScrollText} label="Description">
            <InlineEditDescription
              value={quest.description}
              onSave={(description) => onUpdate({ id: quest.id, description })}
              readOnly={!canManage}
            />
          </DetailField>

          <div className="grid grid-cols-2 gap-4">
            <DetailField icon={Activity} label="Status">
              <InlineEditBadge
                value={quest.status}
                options={STATUS_OPTIONS}
                onSave={(status) =>
                  onUpdate({ id: quest.id, status: status as Quest['status'] })
                }
                label="status"
                readOnly={!canEditStatus}
              />
            </DetailField>

            <DetailField icon={Flag} label="Priority">
              <InlineEditBadge
                value={quest.priority}
                options={PRIORITY_OPTIONS}
                onSave={(priority) =>
                  onUpdate({
                    id: quest.id,
                    priority: priority as Quest['priority'],
                  })
                }
                label="priority"
                readOnly={!canManage}
              />
            </DetailField>

            {guildContext && (
              <DetailField icon={UserRound} label="Assignee">
                {canManage ? (
                  <MemberSelect
                    value={quest.assigneeId}
                    options={guildContext.members}
                    onChange={(userId) =>
                      guildContext.onAssignmentChange({
                        id: quest.id,
                        field: 'assigneeId',
                        userId,
                      })
                    }
                    aria-label="Change assignee"
                    variant="avatar"
                  />
                ) : (
                  <MemberDisplay member={assignee} />
                )}
              </DetailField>
            )}

            {guildContext && (
              <DetailField icon={Eye} label="Supervisor">
                {canManage ? (
                  <MemberSelect
                    value={quest.supervisorId}
                    options={guildContext.members}
                    onChange={(userId) =>
                      guildContext.onAssignmentChange({
                        id: quest.id,
                        field: 'supervisorId',
                        userId,
                      })
                    }
                    aria-label="Change supervisor"
                    variant="avatar"
                  />
                ) : (
                  <MemberDisplay member={supervisor} />
                )}
              </DetailField>
            )}

            <DetailField icon={Calendar} label="Due Date">
              <InlineEditDueDate
                value={quest.dueDate}
                onSave={(dueDate) => onUpdate({ id: quest.id, dueDate })}
                readOnly={!canManage}
              />
            </DetailField>

            <DetailField icon={Clock} label="Created">
              <span className="text-sm text-muted-foreground tabular-nums">
                {dateFormatter.format(new Date(quest.createdAt))}
              </span>
            </DetailField>
          </div>

          <DetailField icon={Tag} label="Tags">
            <InlineEditTags
              value={quest.tags}
              onSave={(tags) => onUpdate({ id: quest.id, tags })}
              readOnly={!canManage}
            />
          </DetailField>
        </div>
      </div>

      {/* Reservado para la futura sección de comentarios/discusión — fuera de
          alcance en esta iteración, solo se deja el espacio delimitado. */}
      <div className="flex items-center gap-2 border-t border-border p-4 text-sm text-muted-foreground/60">
        <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
        Comments coming soon
      </div>
    </div>
  )
}
