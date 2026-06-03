import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useNotificationCenter } from './NotificationCenterProvider'

export function NotificationToast() {
  const { t } = useI18n()
  const { latestPopup, dismissPopup } = useNotificationCenter()

  useEffect(() => {
    if (!latestPopup) {
      return
    }
    const timer = window.setTimeout(dismissPopup, 4500)
    return () => window.clearTimeout(timer)
  }, [dismissPopup, latestPopup])

  if (!latestPopup) {
    return null
  }

  return (
    <aside className="notification-toast" role="status">
      <div>
        <strong>{latestPopup.title}</strong>
        <p>{latestPopup.detail ?? latestPopup.source}</p>
      </div>
      <button type="button" className="icon-button" aria-label={t('common.close')} onClick={dismissPopup}>
        <X size={14} />
      </button>
    </aside>
  )
}
