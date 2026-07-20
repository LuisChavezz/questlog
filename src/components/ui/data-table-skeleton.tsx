/**
 * DataTableSkeleton — filas de carga animadas para DataTable.
 */
import { cn } from '#/lib/utils'

// Borde derecho del último tramo fijo — box-shadow, NO `border-r`. El
// preflight de Tailwind pone `border-collapse: collapse` en todo `<table>`;
// ese algoritmo pinta el borde colapsado en la posición de LAYOUT (estática)
// de la celda, no en su posición VISUAL una vez que `position: sticky` la
// desplaza por scroll — así que el borde se queda atrás, desincronizado del
// contenido que sí se mueve con la celda fija (bug real y documentado de
// `border-collapse` + `sticky` en los motores de layout de tablas). Visible
// en reposo (layout y posición visual coinciden), desaparece al hacer scroll.
// `box-shadow` no participa del algoritmo de colapso de bordes: se pinta en
// la posición VISUAL real de la celda, siga o no fija, así que se mantiene
// sincronizado. Se exporta porque `DataTable` necesita el mismo tratamiento
// en sus celdas reales (header y body).
export const STICKY_LEADING_BORDER_CLASS = 'shadow-[1px_0_0_0_var(--color-border)]'

interface DataTableSkeletonProps {
  columns: number
  rows?: number
  /**
   * Offset izquierdo (px) de cada columna fija inicial, EN ORDEN — mismo
   * array que `DataTable` deriva de su prop `stickyLeadingColumnIds`. Se
   * asume que las columnas fijas son siempre un prefijo (las primeras N), así
   * que solo hace falta la lista de offsets, no los IDs de columna: el
   * skeleton no conoce columnas reales, solo un recuento posicional.
   */
  stickyLeadingOffsets?: readonly number[]
}

export function DataTableSkeleton({
  columns,
  rows = 10,
  stickyLeadingOffsets = [],
}: DataTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border last:border-0">
          {Array.from({ length: columns }).map((_col, j) => {
            const isSticky = j < stickyLeadingOffsets.length
            const isLastSticky = j === stickyLeadingOffsets.length - 1

            return (
              <td
                key={j}
                className={cn(
                  'px-4 py-3',
                  // Mismo tratamiento (fondo opaco, z-index, borde) que las
                  // celdas reales del body — así el header fijo no queda
                  // desincronizado del skeleton al hacer scroll horizontal
                  // durante la carga.
                  isSticky && 'sticky z-10 bg-card',
                  isLastSticky && STICKY_LEADING_BORDER_CLASS,
                )}
                style={isSticky ? { left: stickyLeadingOffsets[j] } : undefined}
              >
                <div
                  className="h-4 rounded-md bg-muted animate-pulse"
                  // Anchos fijos alternados para un skeleton más natural
                  style={{ width: j === 0 ? '70%' : j % 2 === 0 ? '55%' : '40%' }}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
