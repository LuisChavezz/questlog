import * as React from 'react'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          'border-transparent bg-destructive/15 text-destructive dark:bg-destructive/25',
        outline: 'text-foreground border-border',
        // Variantes semánticas para estados de tarea
        backlog:
          'border-transparent bg-muted text-muted-foreground',
        todo: 'border-transparent bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
        in_progress:
          'border-transparent bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
        done: 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
        cancelled:
          'border-transparent bg-muted text-muted-foreground/60 line-through',
        // Variantes de prioridad
        low: 'border-transparent bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
        medium:
          'border-transparent bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
        high: 'border-transparent bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
        urgent:
          'border-transparent bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
