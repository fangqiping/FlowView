import { ChevronLeft, ChevronRight, Pencil, Power, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

export interface MasterDataColumn<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => ReactNode
}

export function MasterDataTable<T extends { id: number; enabled?: boolean }>({
  columns,
  rows,
  pageIndex,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  columns: MasterDataColumn<T>[]
  rows: T[]
  pageIndex: number
  pageSize: number
  totalCount: number
  onPageChange: (next: number) => void
  onPageSizeChange: (next: number) => void
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  onToggleEnabled?: (row: T) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="panel table-panel">
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)}>{column.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={String(column.key)}>
                    {column.render
                      ? column.render(row)
                      : String((row as Record<string, unknown>)[String(column.key)] ?? '-')}
                  </td>
                ))}
                <td>
                  <div className="row-actions">
                    <button type="button" className="icon-button" aria-label="Edit" onClick={() => onEdit(row)}>
                      <Pencil size={16} />
                    </button>
                    {onToggleEnabled && row.enabled !== undefined ? (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={row.enabled ? 'Disable' : 'Enable'}
                        onClick={() => onToggleEnabled(row)}
                      >
                        <Power size={16} />
                      </button>
                    ) : null}
                    <button type="button" className="icon-button" aria-label="Delete" onClick={() => onDelete(row)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager-bar">
        <span>{`Page ${pageIndex}`}</span>
        <select aria-label="Page size" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
        <span>{`${totalCount} items`}</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Previous page"
          disabled={pageIndex <= 1}
          onClick={() => onPageChange(pageIndex - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Next page"
          disabled={pageIndex >= totalPages}
          onClick={() => onPageChange(pageIndex + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
