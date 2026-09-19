import * as React from "react"
import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  header: string
  align?: "left" | "right"
  className?: string
  render: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  getRowKey: (row: T, index: number) => string
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

// Replaces the two hand-rolled tables (members/page.tsx, ScanHistoryTable) that
// shared ~70% structure but zero styling. One header scale, one row scale,
// one loading/empty/error state. Not a generic table lib — no sort/filter,
// since neither caller had that today.
export function DataTable<T>({
  columns,
  data,
  getRowKey,
  loading,
  error,
  emptyMessage = "No results found.",
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="bg-canvas/50 text-[11px] font-bold uppercase tracking-wider text-ink-secondary border-b border-border-subtle">
            {columns.map((col) => (
              <th
                key={col.header}
                className={cn("px-6 py-4", col.align === "right" && "text-right", col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-ink-secondary">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
                  Loading...
                </div>
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-destructive font-medium">
                {error}
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-ink-secondary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={getRowKey(row, idx)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "transition-colors",
                  onRowClick && "cursor-pointer hover:bg-surface-hover"
                )}
              >
                {columns.map((col) => (
                  <td key={col.header} className={cn("px-6 py-4", col.align === "right" && "text-right", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
