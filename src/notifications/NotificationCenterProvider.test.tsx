import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationModel } from '../types'
import { NotificationCenterProvider, useNotificationCenter } from './NotificationCenterProvider'

function Probe() {
  const center = useNotificationCenter()
  return (
    <>
      <div data-testid="unread">{center.unreadCount}</div>
      <div data-testid="popup">{center.latestPopup?.title ?? ''}</div>
    </>
  )
}

describe('NotificationCenterProvider', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('adds received notifications and increments unread count', async () => {
    const handlers = new Map<string, (notification: NotificationModel) => void>()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))

    render(
      <NotificationCenterProvider
        createConnection={() => ({
          on: (event, handler) => handlers.set(event, handler as (notification: NotificationModel) => void),
          start: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined),
        })}
      >
        <Probe />
      </NotificationCenterProvider>,
    )

    await waitFor(() => expect(handlers.has('notification.created')).toBe(true))

    act(() => {
      handlers.get('notification.created')!({
        id: 10,
        level: 1,
        source: 'Console',
        title: 'Warning',
        detail: 'Detail',
        createdTime: new Date().toISOString(),
        confirmed: false,
      })
    })

    expect(screen.getByTestId('unread').textContent).toBe('1')
  })

  it('does not popup information notifications by default', async () => {
    const handlers = new Map<string, (notification: NotificationModel) => void>()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))

    render(
      <NotificationCenterProvider
        createConnection={() => ({
          on: (event, handler) => handlers.set(event, handler as (notification: NotificationModel) => void),
          start: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined),
        })}
      >
        <Probe />
      </NotificationCenterProvider>,
    )

    await waitFor(() => expect(handlers.has('notification.created')).toBe(true))

    act(() => {
      handlers.get('notification.created')!({
        id: 11,
        level: 0,
        source: 'Console',
        title: 'Info',
        detail: 'Detail',
        createdTime: new Date().toISOString(),
        confirmed: false,
      })
    })

    expect(screen.getByTestId('unread').textContent).toBe('1')
    expect(screen.getByTestId('popup').textContent).toBe('')
  })

  it('filters realtime notifications below the receive threshold', async () => {
    const handlers = new Map<string, (notification: NotificationModel) => void>()
    localStorage.setItem('flowview.notificationSettings', JSON.stringify({
      receiveThreshold: 'warning-plus',
      popupThreshold: 'warning-plus',
    }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))

    render(
      <NotificationCenterProvider
        createConnection={() => ({
          on: (event, handler) => handlers.set(event, handler as (notification: NotificationModel) => void),
          start: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined),
        })}
      >
        <Probe />
      </NotificationCenterProvider>,
    )

    await waitFor(() => expect(handlers.has('notification.created')).toBe(true))

    act(() => {
      handlers.get('notification.created')!({
        id: 12,
        level: 0,
        source: 'Console',
        title: 'Info',
        detail: 'Detail',
        createdTime: new Date().toISOString(),
        confirmed: false,
      })
    })

    expect(screen.getByTestId('unread').textContent).toBe('0')
  })
})
