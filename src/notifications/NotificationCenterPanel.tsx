import { Check, X } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'
import type { NotificationLevel } from '../types'
import {
  type NotificationSettings,
  type PopupNotificationThreshold,
  type ReceiveNotificationThreshold,
} from '../lib/notificationSettings'
import { useNotificationCenter } from './NotificationCenterProvider'

interface NotificationCenterPanelProps {
  onClose: () => void
}

const receiveOptions: Array<{ value: ReceiveNotificationThreshold; key: 'notifications.all' | 'notifications.warningPlus' | 'notifications.errorPlus' | 'notifications.criticalOnly' }> = [
  { value: 'all', key: 'notifications.all' },
  { value: 'warning-plus', key: 'notifications.warningPlus' },
  { value: 'error-plus', key: 'notifications.errorPlus' },
  { value: 'critical-only', key: 'notifications.criticalOnly' },
]

const popupOptions: Array<{ value: PopupNotificationThreshold; key: 'notifications.off' | 'notifications.warningPlus' | 'notifications.errorPlus' | 'notifications.criticalOnly' }> = [
  { value: 'off', key: 'notifications.off' },
  { value: 'warning-plus', key: 'notifications.warningPlus' },
  { value: 'error-plus', key: 'notifications.errorPlus' },
  { value: 'critical-only', key: 'notifications.criticalOnly' },
]

export function NotificationCenterPanel({ onClose }: NotificationCenterPanelProps) {
  const { t } = useI18n()
  const {
    notifications,
    settings,
    setSettings,
    confirmNotification,
    connectionState,
  } = useNotificationCenter()

  function updateSettings(next: Partial<NotificationSettings>) {
    setSettings({ ...settings, ...next })
  }

  return (
    <section className="message-center-panel" role="dialog" aria-modal="false" aria-label={t('notifications.messages')}>
      <div className="message-center-header">
        <div>
          <h2>{t('notifications.messages')}</h2>
          <p>{t(connectionStateKey(connectionState))}</p>
        </div>
        <button type="button" className="icon-button" aria-label={t('common.close')} onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="message-settings">
        <label>
          <span>{t('notifications.receiveLevel')}</span>
          <select value={settings.receiveThreshold} onChange={(event) => updateSettings({ receiveThreshold: event.target.value as ReceiveNotificationThreshold })}>
            {receiveOptions.map((option) => <option key={option.value} value={option.value}>{t(option.key)}</option>)}
          </select>
        </label>
        <label>
          <span>{t('notifications.popupLevel')}</span>
          <select value={settings.popupThreshold} onChange={(event) => updateSettings({ popupThreshold: event.target.value as PopupNotificationThreshold })}>
            {popupOptions.map((option) => <option key={option.value} value={option.value}>{t(option.key)}</option>)}
          </select>
        </label>
      </div>

      <div className="message-list">
        {notifications.length === 0 ? (
          <p className="empty-message">{t('notifications.noMessages')}</p>
        ) : notifications.map((notification) => (
          <article key={notification.id} className={`message-item level-${notification.level}`}>
            <div className="message-item-header">
              <span className="status-pill neutral">{t(levelKey(notification.level))}</span>
              <span>{formatTime(notification.createdTime)}</span>
            </div>
            <strong>{notification.title}</strong>
            <p>{notification.source}</p>
            {notification.detail && <p>{notification.detail}</p>}
            {!notification.confirmed && (
              <button className="inline-button" type="button" onClick={() => void confirmNotification(notification.id)}>
                <Check size={14} />
                <span>{t('notifications.markRead')}</span>
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function connectionStateKey(state: 'connecting' | 'connected' | 'disconnected') {
  switch (state) {
    case 'connected':
      return 'notifications.connected'
    case 'connecting':
      return 'notifications.connecting'
    case 'disconnected':
      return 'notifications.disconnected'
  }
}

function levelKey(level: NotificationLevel) {
  switch (level) {
    case 0:
      return 'notifications.information'
    case 1:
      return 'notifications.warning'
    case 2:
      return 'notifications.error'
    case 3:
      return 'notifications.critical'
  }
}

function formatTime(value?: string | null) {
  if (!value) {
    return ''
  }
  return new Date(value).toLocaleString()
}
