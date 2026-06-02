import type { NotificationLevel } from '../types'

export type ReceiveNotificationThreshold = 'all' | 'warning-plus' | 'error-plus' | 'critical-only'
export type PopupNotificationThreshold = 'off' | 'warning-plus' | 'error-plus' | 'critical-only'

export interface NotificationSettings {
  receiveThreshold: ReceiveNotificationThreshold
  popupThreshold: PopupNotificationThreshold
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  receiveThreshold: 'all',
  popupThreshold: 'warning-plus',
}

const SETTINGS_STORAGE_KEY = 'flowview.notificationSettings'

const levelThresholds: Record<
  Exclude<ReceiveNotificationThreshold | PopupNotificationThreshold, 'all' | 'off'>,
  NotificationLevel
> = {
  'warning-plus': 1,
  'error-plus': 2,
  'critical-only': 3,
}

export function notificationLevelMeetsThreshold(
  level: NotificationLevel,
  threshold: ReceiveNotificationThreshold | PopupNotificationThreshold,
) {
  if (threshold === 'all') {
    return true
  }
  if (threshold === 'off') {
    return false
  }
  return level >= levelThresholds[threshold]
}

export function loadNotificationSettings(): NotificationSettings {
  const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (!stored) {
    return DEFAULT_NOTIFICATION_SETTINGS
  }

  try {
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) } as NotificationSettings
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS
  }
}

export function saveNotificationSettings(settings: NotificationSettings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}
