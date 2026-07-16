import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { NotificationCenterProvider } from '../notifications/NotificationCenterProvider'
import { AppShell } from './AppShell'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('AppShell notifications', () => {
  it('shows a message center button', () => {
    localStorage.setItem('flowview.language', 'en-US')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))

    render(
      <I18nProvider>
        <NotificationCenterProvider autoConnect={false}>
          <MemoryRouter>
            <AppShell />
          </MemoryRouter>
        </NotificationCenterProvider>
      </I18nProvider>,
    )

    expect(screen.getByRole('button', { name: /messages/i })).toBeTruthy()
  })

  it('shows a translated scheduling link', () => {
    localStorage.setItem('flowview.language', 'zh-Hans-CN')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))

    render(
      <I18nProvider>
        <NotificationCenterProvider autoConnect={false}>
          <MemoryRouter>
            <AppShell />
          </MemoryRouter>
        </NotificationCenterProvider>
      </I18nProvider>,
    )

    expect(screen.getByRole('link', { name: '全局调度' }).getAttribute('href'))
      .toBe('/scheduling')
  })
})
