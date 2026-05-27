import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { MasterDataTable } from '../components/MasterDataTable'
import { LocationsPage } from './LocationsPage'

describe('MasterDataTable', () => {
  it('renders rows, pager state, and row actions', () => {
    render(
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
      />,
    )

    expect(screen.getByText('RACK-A1')).toBeTruthy()
    expect(screen.getByText('Page 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
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
      <MemoryRouter>
        <LocationsPage apiOverride={api as never} />
      </MemoryRouter>,
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
      <MemoryRouter>
        <LocationsPage apiOverride={api as never} />
      </MemoryRouter>,
    )

    expect((await screen.findAllByText('RACK-A1')).length).toBeGreaterThan(0)
    const disableButtons = screen.getAllByRole('button', { name: 'Disable' })
    fireEvent.click(disableButtons[disableButtons.length - 1]!)

    await waitFor(() => {
      expect(api.updateLocation).toHaveBeenCalledWith(1, expect.objectContaining({ enabled: false }))
    })
  })

  it('shows master-data navigation entries', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Locations').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ports').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pallets').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Skus').length).toBeGreaterThan(0)
  })
})
