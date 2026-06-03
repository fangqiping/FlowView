import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { createNotificationConnection, type NotificationConnection } from '../lib/notificationConnection'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  notificationLevelMeetsThreshold,
  saveNotificationSettings,
  type NotificationSettings,
} from '../lib/notificationSettings'
import type { NotificationModel } from '../types'

const NOTIFICATION_CREATED_EVENT = 'notification.created'

type ConnectionState = 'connecting' | 'connected' | 'disconnected'

export interface NotificationCenterState {
  notifications: NotificationModel[]
  unreadCount: number
  settings: NotificationSettings
  setSettings: (settings: NotificationSettings) => void
  confirmNotification: (id: number) => Promise<void>
  connectionState: ConnectionState
  latestPopup: NotificationModel | null
  dismissPopup: () => void
}

interface NotificationCenterProviderProps {
  children: ReactNode
  autoConnect?: boolean
  createConnection?: () => NotificationConnection
}

const NotificationCenterContext = createContext<NotificationCenterState | null>(null)

export function NotificationCenterProvider({
  children,
  autoConnect = true,
  createConnection = createNotificationConnection,
}: NotificationCenterProviderProps) {
  const [notifications, setNotifications] = useState<NotificationModel[]>([])
  const [settings, setSettingsState] = useState<NotificationSettings>(() => {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_NOTIFICATION_SETTINGS
    }
    return loadNotificationSettings()
  })
  const [connectionState, setConnectionState] = useState<ConnectionState>(autoConnect ? 'connecting' : 'disconnected')
  const [latestPopup, setLatestPopup] = useState<NotificationModel | null>(null)

  const setSettings = useCallback((nextSettings: NotificationSettings) => {
    setSettingsState(nextSettings)
    saveNotificationSettings(nextSettings)
  }, [])

  const addNotification = useCallback((notification: NotificationModel, fromRealtime: boolean) => {
    if (fromRealtime && !notificationLevelMeetsThreshold(notification.level, settings.receiveThreshold)) {
      return
    }

    setNotifications((current) => {
      if (current.some((item) => item.id === notification.id)) {
        return current
      }
      return [notification, ...current]
    })

    if (fromRealtime && notificationLevelMeetsThreshold(notification.level, settings.popupThreshold)) {
      setLatestPopup(notification)
    }
  }, [settings.popupThreshold, settings.receiveThreshold])

  useEffect(() => {
    let canceled = false

    async function loadInitial() {
      try {
        const response = await api.getNotifications()
        if (!canceled) {
          setNotifications(response.items)
        }
      } catch {
        if (!canceled) {
          setNotifications([])
        }
      }
    }

    void loadInitial()

    return () => {
      canceled = true
    }
  }, [])

  useEffect(() => {
    if (!autoConnect) {
      return
    }

    const connection = createConnection()
    let disposed = false
    setConnectionState('connecting')
    connection.on(NOTIFICATION_CREATED_EVENT, (notification) => {
      addNotification(notification as NotificationModel, true)
    })

    connection.start()
      .then(() => {
        if (!disposed) {
          setConnectionState('connected')
        }
      })
      .catch(() => {
        if (!disposed) {
          setConnectionState('disconnected')
        }
      })

    return () => {
      disposed = true
      setConnectionState('disconnected')
      void connection.stop()
    }
  }, [addNotification, autoConnect, createConnection])

  const confirmNotification = useCallback(async (id: number) => {
    await api.confirmNotification(id)
    setNotifications((current) => current.map((notification) => (
      notification.id === id
        ? { ...notification, confirmed: true, confirmedTime: new Date().toISOString() }
        : notification
    )))
  }, [])

  const unreadCount = notifications.filter((notification) => !notification.confirmed).length

  const value = useMemo<NotificationCenterState>(() => ({
    notifications,
    unreadCount,
    settings,
    setSettings,
    confirmNotification,
    connectionState,
    latestPopup,
    dismissPopup: () => setLatestPopup(null),
  }), [confirmNotification, connectionState, latestPopup, notifications, setSettings, settings, unreadCount])

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
    </NotificationCenterContext.Provider>
  )
}

export function useNotificationCenter() {
  const value = useContext(NotificationCenterContext)
  if (!value) {
    throw new Error('useNotificationCenter must be used within NotificationCenterProvider.')
  }
  return value
}
