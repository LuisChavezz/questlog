/**
 * InlineEditBadge — edición en línea de un campo de selección (status/priority).
 * Renderiza un Badge que al hacer clic abre un dropdown con todas las opciones.
 * Al seleccionar una opción, guarda el cambio de inmediato.
 */
import { CheckIcon } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import type { BadgeProps } from '#/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

export interface BadgeOption {
  value: string
  label: string
  icon: React.ElementType
  variant: BadgeProps['variant']
}

interface InlineEditBadgeProps {
  value: string
  options: readonly BadgeOption[]
  onSave: (newValue: string) => void
  /** Describe el campo — usado en el aria-label del trigger */
  label: string
  /** Solo lectura: muestra el badge sin dropdown de edición */
  readOnly?: boolean
}

export function InlineEditBadge({
  value,
  options,
  onSave,
  label,
  readOnly = false,
}: InlineEditBadgeProps) {
  const current = options.find((o) => o.value === value)
  if (!current) return null

  const CurrentIcon = current.icon

  // Solo lectura: mismo badge, sin trigger ni hover interactivo
  if (readOnly) {
    return (
      <Badge variant={current.variant}>
        <CurrentIcon className="size-3" />
        {current.label}
      </Badge>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1"
          aria-label={`Change ${label}: ${current.label}`}
        >
          <Badge
            variant={current.variant}
            className="cursor-pointer transition-opacity hover:opacity-75"
          >
            <CurrentIcon className="size-3" />
            {current.label}
          </Badge>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-44">
        {options.map((option) => {
          const Icon = option.icon
          const isSelected = option.value === value
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => {
                if (option.value !== value) onSave(option.value)
              }}
              className="gap-2"
            >
              <Icon className="size-3.5 text-muted-foreground" />
              <span className="flex-1">{option.label}</span>
              {isSelected && <CheckIcon className="size-3.5 text-muted-foreground" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
