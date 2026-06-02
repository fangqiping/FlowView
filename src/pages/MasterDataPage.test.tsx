import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AppShell } from '../components/AppShell'
import { MasterDataTable } from '../components/MasterDataTable'
import { I18nProvider } from '../i18n/I18nProvider'
import { NotificationCenterProvider } from '../notifications/NotificationCenterProvider'
import { LocationsPage } from './LocationsPage'

describe('MasterDataTable', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('renders rows, pager state, and row actions', () => {
    render(
      <I18nProvider>
        <MasterDataTable
          columns={[{ key: 'code', label: 'Code' }]}
          rows={[{ id: 1, code: 'RACK-A1', enabled: true }]}
          pageIndex={1}
          pageSize={20}
          totalCount={41}
          onPageChange={() => {}}
          onPageSizeChange={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onToggleEnabled={() => {}}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('RACK-A1')).toBeTruthy()
    expect(screen.getByText('Page 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
  })

  it('renders translated row action labels', () => {
    localStorage.setItem('flowview.language', 'zh-Hans-CN')

    render(
      <I18nProvider>
        <MasterDataTable
          columns={[{ key: 'code', label: 'Code' }]}
          rows={[{ id: 1, code: 'RACK-A1', enabled: true }]}
          pageIndex={1}
          pageSize={20}
          totalCount={41}
          onPageChange={() => {}}
          onPageSizeChange={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onToggleEnabled={() => {}}
        />
      </I18nProvider>,
    )

    expect(screen.getByRole('button', { name: '编辑' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '停用' })).toBeTruthy()
    expect(screen.getByLabelText('每页数量')).toBeTruthy()
  })

  it('loads paged locations and opens the create dialog', async () => {
    const api = {
      getLocationsPage: vi.fn().mockResolvedValue({
        items: [{ id: 1, code: 'RACK-A1', name: 'Rack A1', enabled: true, acquired: false, locationType: 1, status: 1, warehouseId: 1, currentPalletId: null }],
        totalCount: 1,
        pageIndex: 1,
        pageSize: 20,
      }),
      getWarehouses: vi.fn().mockResolvedValue({
        items: [{ id: 1, code: 'WH-01', name: 'Demo Warehouse' }],
      }),
      getPallets: vi.fn().mockResolvedValue({
        items: [],
      }),
      createLocation: vi.fn(),
      updateLocation: vi.fn(),
      deleteLocation: vi.fn(),
    }

    render(
      <I18nProvider>
        <MemoryRouter>
          <LocationsPage apiOverride={api as never} />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect((await screen.findAllByText('RACK-A1')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /new/i }))
    expect(screen.getByRole('dialog', { name: /new location/i })).toBeTruthy()
  })

  it('toggles enabled state through row actions', async () => {
    const api = {
      getLocationsPage: vi.fn().mockResolvedValue({
        items: [{ id: 1, code: 'RACK-A1', name: 'Rack A1', enabled: true, acquired: false, locationType: 1, status: 1, warehouseId: 1, currentPalletId: null }],
        totalCount: 1,
        pageIndex: 1,
        pageSize: 20,
      }),
      getWarehouses: vi.fn().mockResolvedValue({
        items: [{ id: 1, code: 'WH-01', name: 'Demo Warehouse' }],
      }),
      getPallets: vi.fn().mockResolvedValue({
        items: [],
      }),
      createLocation: vi.fn(),
      updateLocation: vi.fn().mockResolvedValue({}),
      deleteLocation: vi.fn(),
    }

    render(
      <I18nProvider>
        <MemoryRouter>
          <LocationsPage apiOverride={api as never} />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect((await screen.findAllByText('RACK-A1')).length).toBeGreaterThan(0)
    const disableButtons = screen.getAllByRole('button', { name: 'Disable' })
    fireEvent.click(disableButtons[disableButtons.length - 1]!)

    await waitFor(() => {
      expect(api.updateLocation).toHaveBeenCalledWith(1, expect.objectContaining({ enabled: false }))
    })
  })

  it('shows master-data navigation entries', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))

    render(
      <I18nProvider>
        <NotificationCenterProvider autoConnect={false}>
          <MemoryRouter>
            <App />
          </MemoryRouter>
        </NotificationCenterProvider>
      </I18nProvider>,
    )

    expect(screen.getAllByText('Locations').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ports').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pallets').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Skus').length).toBeGreaterThan(0)
  })

  it('switches shell navigation language', () => {
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

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'zh-Hans-CN' } })

    expect(screen.getByText('入库订单')).toBeTruthy()
    expect(screen.getByText('流程定义')).toBeTruthy()
  })
})
