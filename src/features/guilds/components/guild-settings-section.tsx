/**
 * Bloques de layout de la página de Settings del guild: cada sección es un
 * título con descripción más una card, y cada ajuste dentro de ella una fila
 * "etiqueta + ayuda a la izquierda, control a la derecha" (mismo patrón que
 * el Settings dialog del usuario). Solo layout: sin estado ni datos.
 */
import { useId } from 'react'
import type { ReactNode } from 'react'

import { Card } from '#/components/ui/card'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'

type GuildSettingsSectionProps = {
  title: string
  description?: ReactNode
  // 'destructive' marca la Danger Zone: borde y título en color destructivo
  // para que no se confunda con los ajustes normales.
  variant?: 'default' | 'destructive'
  id?: string
  children: ReactNode
}

export function GuildSettingsSection({
  title,
  description,
  variant = 'default',
  id,
  children,
}: GuildSettingsSectionProps) {
  const isDestructive = variant === 'destructive'
  const titleId = useId()

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      // Dos columnas en pantallas anchas: título y descripción a la izquierda,
      // la card con los controles a la derecha (patrón de settings de GitHub /
      // Linear). Se apila por debajo de xl y no de lg: con el sidebar
      // expandido, a 1024px la card quedaría en ~420px y las filas se
      // apretarían. scroll-mt: el ancla (#invitation) no debe quedar pegada
      // al borde.
      className="grid scroll-mt-6 gap-4 xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-10"
    >
      <header className="flex flex-col gap-1 xl:pt-4">
        <h3
          id={titleId}
          className={cn(
            'text-base font-semibold',
            isDestructive ? 'text-destructive' : 'text-foreground',
          )}
        >
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </header>
      {/* Las filas se separan con divisores; el contenido libre (formularios)
          trae su propio espaciado */}
      <Card
        className={cn(
          'gap-0 divide-y py-0',
          isDestructive
            ? 'divide-destructive/20 border-destructive/40'
            : 'divide-border',
        )}
      >
        {children}
      </Card>
    </section>
  )
}

type GuildSettingsRowProps = {
  label: ReactNode
  // id del control al que pertenece la etiqueta: con él la etiqueta se rinde
  // como <Label htmlFor> (clic enfoca el campo y da su nombre accesible)
  labelFor?: string
  description?: ReactNode
  // Error de la acción de la fila. Va debajo de la descripción, no en su
  // lugar: la ayuda (p. ej. "This cannot be undone") debe seguir visible.
  error?: ReactNode
  // Control a la derecha (botón, toggle…). En pantallas estrechas baja debajo
  // del texto en vez de comprimirlo.
  action?: ReactNode
  // Contenido a ancho completo bajo la etiqueta (p. ej. el campo del link)
  children?: ReactNode
  // Elemento visual a la izquierda del texto (p. ej. el escudo)
  leading?: ReactNode
}

export function GuildSettingsRow({
  label,
  labelFor,
  description,
  error,
  action,
  children,
  leading,
}: GuildSettingsRowProps) {
  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="flex min-w-0 flex-col gap-1">
            {labelFor ? (
              <Label htmlFor={labelFor}>{label}</Label>
            ) : (
              <p className="text-sm font-medium text-foreground">{label}</p>
            )}
            {description && (
              <div className="text-sm text-muted-foreground">{description}</div>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}
