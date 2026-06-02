import { ChevronLeft, ChevronRight, Pencil, Power, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'

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
  const { t } = useI18n()
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
              <th>{t('table.actions')}</th>
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
                    <button type="button" className="icon-button" aria-label={t('table.edit')} onClick={() => onEdit(row)}>
                      <Pencil size={16} />
                    </button>
                    {onToggleEnabled && row.enabled !== undefined ? (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={row.enabled ? t('table.disable') : t('table.enable')}
                        onClick={() => onToggleEnabled(row)}
                      >
                        <Power size={16} />
                      </button>
                    ) : null}
                    <button type="button" className="icon-button" aria-label={t('table.delete')} onClick={() => onDelete(row)}>
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
        <span>{t('table.page', { page: pageIndex })}</span>
        <select aria-label={t('table.pageSize')} value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {t('table.perPage', { size })}
            </option>
          ))}
        </select>
        <span>{t('table.totalItems', { count: totalCount })}</span>
        <button
          type="button"
          className="icon-button"
          aria-label={t('table.previousPage')}
          disabled={pageIndex <= 1}
          onClick={() => onPageChange(pageIndex - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t('table.nextPage')}
          disabled={pageIndex >= totalPages}
          onClick={() => onPageChange(pageIndex + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
