/**
 * DataTableSkeleton — filas de carga animadas para DataTable.
 */

interface DataTableSkeletonProps {
  columns: number
  rows?: number
}

export function DataTableSkeleton({
  columns,
  rows = 10,
}: DataTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border last:border-0">
          {Array.from({ length: columns }).map((_col, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-4 rounded-md bg-muted animate-pulse"
                // Anchos fijos alternados para un skeleton más natural
                style={{ width: j === 0 ? '70%' : j % 2 === 0 ? '55%' : '40%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
