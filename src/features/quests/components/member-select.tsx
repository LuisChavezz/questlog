/**
 * MemberSelect — selector de un miembro de guild (asignado o supervisor).
 * Fuente única para las dos posiciones donde se elige un miembro: el formulario
 * de creación de quest de guild (variante "default", trigger espacioso) y la
 * edición inline en la tabla de quests (variante "avatar", compacta: avatar +
 * nombre truncado, con el chevron solo al hover para no ensuciar la celda).
 * Reutiliza UserAvatar para cada opción y expone un valor `string | null`
 * (null = sin asignar) para no acoplar a los llamadores al centinela interno.
 */
import type { AriaAttributes } from 'react'
import { ChevronDown, User } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Tooltip } from '#/components/ui/tooltip'
import { UserAvatar } from '#/components/user-avatar'
import { useIsTruncated } from '#/hooks/use-is-truncated'
import { cn } from '#/lib/utils'

// Datos mínimos que necesita el selector para pintar cada miembro. Los miembros
// de un guild (`getGuild().members`) cumplen esta forma con campos de más.
export interface MemberOption {
  userId: string
  name: string | null
  image?: string | null
  avatarId?: string | null
  initials?: string | null
}

// Radix Select no admite un value de cadena vacía, así que "sin asignar" usa un
// centinela interno que nunca se expone hacia afuera. Exportado porque el
// filtro de Assignee de la tabla (fuera de este archivo) necesita el mismo
// valor para representar "sin asignar" dentro de un `string[]` de filtro.
export const UNASSIGNED_VALUE = '__unassigned__'

interface MemberSelectProps {
  // Id del usuario seleccionado, o null cuando no hay asignación
  value: string | null
  options: MemberOption[]
  onChange: (userId: string | null) => void
  placeholder?: string
  unassignedLabel?: string
  id?: string
  'aria-label'?: string
  disabled?: boolean
  triggerClassName?: string
  size?: 'sm' | 'default'
  // "default": trigger espacioso con avatar + nombre + chevron fijo (formulario
  // de creación). "avatar": trigger compacto con nombre truncado y chevron solo
  // al hover (celda de la tabla de quests).
  variant?: 'default' | 'avatar'
}

// Etiqueta de una opción dentro del dropdown: avatar + nombre. El dropdown
// siempre muestra esto, sin importar la variante del trigger.
function MemberOptionLabel({ member }: { member: MemberOption }) {
  return (
    <>
      <UserAvatar
        name={member.name}
        image={member.image}
        avatarId={member.avatarId}
        initials={member.initials}
        size="sm"
      />
      <span className="truncate">{member.name ?? 'Unknown member'}</span>
    </>
  )
}

// Avatar del miembro asignado, o un ícono de persona genérico si no hay
// asignación — mismo tamaño que UserAvatar "sm" para que la columna no
// cambie de ancho/alto entre filas asignadas y sin asignar. Exportado: el
// filtro de Assignee/Supervisor reutiliza este mismo placeholder para su
// opción "Unassigned" y sus opciones de miembro — con `size="xs"` ahí para
// igualar el tamaño de los íconos simples (Status/Priority) en la misma
// lista de checkboxes, en vez de quedar ~1.7x más grande.
export function MemberAvatarOrPlaceholder({
  member,
  size = 'sm',
  'aria-hidden': ariaHidden,
}: {
  member: MemberOption | null | undefined
  size?: 'xs' | 'sm'
  /**
   * Marca el avatar entero como decorativo para lectores de pantalla. En el
   * filtro de Assignee/Supervisor el nombre del miembro ya aparece como texto
   * al lado, y sin esto el fallback de iniciales del avatar se anunciaría por
   * duplicado ("GH Grace Hopper").
   */
  'aria-hidden'?: AriaAttributes['aria-hidden']
}) {
  if (!member) {
    return (
      <span
        aria-hidden={ariaHidden}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
          size === 'xs' ? 'size-4' : 'size-6',
        )}
      >
        <User
          className={size === 'xs' ? 'size-2.5' : 'size-3.5'}
          aria-hidden="true"
        />
      </span>
    )
  }

  return (
    <UserAvatar
      name={member.name}
      image={member.image}
      avatarId={member.avatarId}
      initials={member.initials}
      size={size}
      aria-hidden={ariaHidden}
    />
  )
}

// Texto visible del miembro: su nombre, o la etiqueta de "sin asignar".
function getMemberLabel(
  member: MemberOption | null | undefined,
  unassignedLabel: string,
) {
  if (!member) return unassignedLabel
  return member.name ?? 'Unknown member'
}

export function MemberSelect({
  value,
  options,
  onChange,
  placeholder = 'Unassigned',
  unassignedLabel = 'Unassigned',
  id,
  'aria-label': ariaLabel,
  disabled,
  triggerClassName,
  size = 'default',
  variant = 'default',
}: MemberSelectProps) {
  const selected = options.find((member) => member.userId === value) ?? null
  const label = getMemberLabel(selected, unassignedLabel)
  const [nameRef, isNameTruncated] = useIsTruncated<HTMLSpanElement>(label)

  const avatarTrigger = (
    <SelectPrimitive.Trigger
      id={id}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'group/member flex w-full min-w-0 items-center gap-2 rounded-md outline-none',
        'cursor-pointer text-left text-sm text-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Radix descarta el className de SelectValue, así que su span se
        // estiliza desde aquí vía su data-slot (mismo truco que usa shadcn).
        '*:data-[slot=select-value]:flex *:data-[slot=select-value]:shrink-0 *:data-[slot=select-value]:items-center',
        triggerClassName,
      )}
    >
      {/*
       * `SelectValue` es obligatorio aunque no muestre texto: con
       * position="item-aligned" (el default de SelectContent) Radix alinea el
       * dropdown contra el nodo del valor y ABORTA el cálculo entero si ese
       * nodo no existe — el dropdown se abría sin posicionar (invisible) y, al
       * hacerlo, DismissableLayer dejaba toda la página en pointer-events:none.
       * El avatar va dentro; el nombre puede ir fuera porque para el cálculo
       * solo cuenta el borde izquierdo del nodo, que es el del avatar igual.
       */}
      <SelectValue>
        <MemberAvatarOrPlaceholder member={selected} />
      </SelectValue>

      <span
        ref={nameRef}
        className={cn(
          'min-w-0 flex-1 truncate',
          !selected && 'text-muted-foreground',
        )}
      >
        {label}
      </span>

      {/* Chevron: afordancia de edición que solo aparece al hover/foco. Se
          oculta con opacity (no display) para que la celda no salte de ancho. */}
      <ChevronDown
        className={cn(
          'pointer-events-none size-3.5 shrink-0 text-muted-foreground opacity-0',
          'transition-opacity duration-150 ease-out motion-reduce:transition-none',
          'group-hover/member:opacity-100 group-focus-visible/member:opacity-100',
        )}
        aria-hidden="true"
      />
    </SelectPrimitive.Trigger>
  )

  const trigger =
    variant === 'avatar' ? (
      // El tooltip solo aporta cuando el nombre está recortado; si cabe entero
      // repetiría texto ya visible.
      isNameTruncated ? (
        <Tooltip content={label} side="top">
          {avatarTrigger}
        </Tooltip>
      ) : (
        avatarTrigger
      )
    ) : (
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        size={size}
        className={triggerClassName}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
    )

  return (
    <Select
      value={value ?? UNASSIGNED_VALUE}
      onValueChange={(next) =>
        onChange(next === UNASSIGNED_VALUE ? null : next)
      }
      disabled={disabled}
    >
      {trigger}
      <SelectContent>
        <SelectItem value={UNASSIGNED_VALUE}>
          <span className="text-muted-foreground">{unassignedLabel}</span>
        </SelectItem>
        {options.map((member) => (
          <SelectItem key={member.userId} value={member.userId}>
            <MemberOptionLabel member={member} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Presentación de solo lectura de un miembro asignado — para filas de la tabla
// que el usuario actual no puede editar. Mismo layout que la variante "avatar"
// (avatar + nombre truncado) pero sin chevron: aquí no hay nada que abrir.
export function MemberDisplay({
  member,
}: {
  member: MemberOption | undefined
}) {
  const label = getMemberLabel(member, 'Unassigned')
  const [nameRef, isNameTruncated] = useIsTruncated<HTMLSpanElement>(label)

  const content = (
    <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
      <MemberAvatarOrPlaceholder member={member} />
      <span
        ref={nameRef}
        className={cn(
          'min-w-0 flex-1 truncate',
          !member && 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </span>
  )

  return isNameTruncated ? (
    <Tooltip content={label} side="top">
      {content}
    </Tooltip>
  ) : (
    content
  )
}
