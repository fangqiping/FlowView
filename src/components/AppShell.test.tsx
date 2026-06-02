import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { NotificationCenterProvider } from '../notifications/NotificationCenterProvider'
import { AppShell } from './AppShell'

describe('AppShell notifications', () => {
  it('shows a message center button', () => {
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
})
