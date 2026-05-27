import type { ReactNode } from 'react'

export function MasterDataDialog({
  open,
  title,
  children,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  onSubmit: () => void
}) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-scrim" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-header">
          <h3>{title}</h3>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={onSubmit}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
