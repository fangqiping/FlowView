import type { ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'

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
  const { t } = useI18n()

  if (!open) {
    return null
  }

  return (
    <div className="modal-scrim" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-header">
          <h3>{title}</h3>
          <button type="button" className="icon-button" aria-label={t('common.close')} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('actions.cancel')}
          </button>
          <button type="button" className="primary-button" onClick={onSubmit}>
            {t('actions.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
