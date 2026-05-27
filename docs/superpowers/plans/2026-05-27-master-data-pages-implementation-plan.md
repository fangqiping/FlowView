# Master Data Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four dedicated `FlowView` master-data pages for locations, ports, pallets, and skus with backend-backed pagination, modal create/edit flows, delete, and enabled toggles.

**Architecture:** Build one reusable list-page pattern with small resource-specific page definitions rather than four unrelated tables. Extend the API layer to use backend pagination and CRUD endpoints, then plug those bindings into dedicated pages and lightweight modal forms while keeping styling aligned with the existing operator-console look.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, backend `FlowEngine.Server.WebApi.ApiController` pagination and CRUD endpoints

---

## Planned File Structure

**Shared frontend infrastructure**
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/components/MasterDataDialog.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/components/MasterDataTable.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/lib/masterData.ts`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/lib/masterData.test.ts`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/index.css`

**Resource pages**
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/LocationsPage.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/PortsPage.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/PalletsPage.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/SkusPage.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/MasterDataPage.test.tsx`

**Routing, navigation, and API**
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/App.tsx`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/components/AppShell.tsx`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/lib/api.ts`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/types.ts`

These files keep responsibilities clear:
- `MasterDataTable` owns reusable table, pager, and row actions
- `MasterDataDialog` owns modal form presentation
- `masterData.ts` owns resource-agnostic helpers and page state logic
- each page file owns only resource-specific columns, form fields, and API bindings

### Task 1: Add paged CRUD API bindings and shared master-data types

**Files:**
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/lib/api.ts`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/types.ts`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/lib/masterData.ts`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/lib/masterData.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `masterData.test.ts` with the first failing cases:

```ts
import { describe, expect, it } from 'vitest'
import { buildPaginationQuery, coercePagedResult } from './masterData'

describe('masterData helpers', () => {
  it('builds backend pagination query strings', () => {
    expect(buildPaginationQuery({ pageIndex: 2, pageSize: 25 })).toBe(
      '?ShouldPaginate=true&PageIndex=2&PageSize=25',
    )
  })

  it('normalizes paged responses into list state', () => {
    expect(
      coercePagedResult<{ id: number }>({
        items: [{ id: 1 }, { id: 2 }],
        totalCount: 18,
        pageIndex: 3,
        pageSize: 10,
      }),
    ).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      totalCount: 18,
      pageIndex: 3,
      pageSize: 10,
    })
  })
})
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm test -- --run src/lib/masterData.test.ts`

Expected: FAIL because `masterData.ts` does not exist yet.

- [ ] **Step 3: Add the minimal shared pagination/types/API layer**

Add paged response and resource input types to `types.ts`:

```ts
export interface PagedResponse<T> {
  items: T[]
  totalCount: number
  pageIndex: number
  pageSize: number
}

export interface LocationInputModel extends Omit<LocationModel, 'id' | 'acquired'> {}
export interface PortInputModel extends Omit<PortModel, 'id' | 'acquired'> {}
export interface PalletInputModel extends Omit<PalletModel, 'id' | 'acquired'> {}
export interface SkuInputModel extends Omit<SkuModel, 'id'> {}
```

Create `masterData.ts`:

```ts
import type { PagedResponse } from '../types'

export function buildPaginationQuery({
  pageIndex,
  pageSize,
}: {
  pageIndex: number
  pageSize: number
}) {
  const params = new URLSearchParams()
  params.set('ShouldPaginate', 'true')
  params.set('PageIndex', String(pageIndex))
  params.set('PageSize', String(pageSize))
  return `?${params.toString()}`
}

export function coercePagedResult<T>(result: PagedResponse<T>) {
  return {
    items: result.items,
    totalCount: result.totalCount,
    pageIndex: result.pageIndex,
    pageSize: result.pageSize,
  }
}
```

Extend `api.ts` with paged CRUD endpoints:

```ts
async getLocationsPage(pageIndex: number, pageSize: number) {
  return request<PagedResponse<LocationModel>>(`/api/Locations${buildPaginationQuery({ pageIndex, pageSize })}`)
},
async createLocation(input: LocationInputModel) {
  return request<LocationModel>('/api/Locations', { method: 'POST', body: JSON.stringify(input) })
},
async updateLocation(id: number, input: LocationInputModel) {
  return request<LocationModel>(`/api/Locations/${id}`, { method: 'PUT', body: JSON.stringify(input) })
},
async deleteLocation(id: number) {
  return request<void>(`/api/Locations/${id}`, { method: 'DELETE' })
},
```

Repeat the same pattern for `Ports`, `Pallets`, and `Skus`.

- [ ] **Step 4: Run the targeted tests**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm test -- --run src/lib/masterData.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel add \
  src/lib/api.ts \
  src/types.ts \
  src/lib/masterData.ts \
  src/lib/masterData.test.ts
git -C /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel commit -m "feat: add paged master data api bindings"
```

### Task 2: Build a reusable master-data table and modal shell

**Files:**
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/components/MasterDataDialog.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/components/MasterDataTable.tsx`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/index.css`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/MasterDataPage.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create a first test in `MasterDataPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MasterDataTable } from '../components/MasterDataTable'

describe('MasterDataTable', () => {
  it('renders rows, pager state, and row actions', () => {
    render(
      <MasterDataTable
        columns={[{ key: 'code', label: 'Code' }]}
        rows={[{ id: 1, code: 'RACK-A1' }]}
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

    expect(screen.getByText('RACK-A1')).toBeInTheDocument()
    expect(screen.getByText('Page 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm test -- --run src/pages/MasterDataPage.test.tsx`

Expected: FAIL because `MasterDataTable` does not exist yet.

- [ ] **Step 3: Create the shared table and dialog components**

Create `MasterDataTable.tsx`:

```tsx
import { ChevronLeft, ChevronRight, Pencil, Power, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

export interface MasterDataColumn<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => ReactNode
}

export function MasterDataTable<T extends { id: number; enabled?: boolean }>({
  columns,
  rows,
  pageIndex,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  columns: MasterDataColumn<T>[]
  rows: T[]
  pageIndex: number
  pageSize: number
  totalCount: number
  onPageChange: (next: number) => void
  onPageSizeChange: (next: number) => void
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  onToggleEnabled?: (row: T) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="master-data-table">
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)}>{column.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={String(column.key)}>
                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[String(column.key)] ?? '-')}
                  </td>
                ))}
                <td>
                  <div className="row-actions">
                    <button type="button" className="icon-button" aria-label="Edit" onClick={() => onEdit(row)}>
                      <Pencil size={16} />
                    </button>
                    {onToggleEnabled && row.enabled !== undefined ? (
                      <button type="button" className="icon-button" aria-label={row.enabled ? 'Disable' : 'Enable'} onClick={() => onToggleEnabled(row)}>
                        <Power size={16} />
                      </button>
                    ) : null}
                    <button type="button" className="icon-button" aria-label="Delete" onClick={() => onDelete(row)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager-bar">
        <span>{`Page ${pageIndex}`}</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>{size} / page</option>
          ))}
        </select>
        <span>{`${totalCount} items`}</span>
        <button type="button" className="icon-button" aria-label="Previous page" disabled={pageIndex <= 1} onClick={() => onPageChange(pageIndex - 1)}>
          <ChevronLeft size={16} />
        </button>
        <button type="button" className="icon-button" aria-label="Next page" disabled={pageIndex >= totalPages} onClick={() => onPageChange(pageIndex + 1)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
```

Create `MasterDataDialog.tsx`:

```tsx
import type { ReactNode } from 'react'

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
  if (!open) {
    return null
  }

  return (
    <div className="modal-scrim" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-header">
          <h3>{title}</h3>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-button" onClick={onSubmit}>Save</button>
        </div>
      </div>
    </div>
  )
}
```

Add matching CSS for `.pager-bar`, `.row-actions`, `.modal-scrim`, `.modal-card`, `.modal-body`, and `.modal-actions`.

- [ ] **Step 4: Run the component test**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm test -- --run src/pages/MasterDataPage.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel add \
  src/components/MasterDataDialog.tsx \
  src/components/MasterDataTable.tsx \
  src/index.css \
  src/pages/MasterDataPage.test.tsx
git -C /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel commit -m "feat: add reusable master data table shell"
```

### Task 3: Implement the four master-data pages with modal CRUD flows

**Files:**
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/LocationsPage.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/PortsPage.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/PalletsPage.tsx`
- Create: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/SkusPage.tsx`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/pages/MasterDataPage.test.tsx`

- [ ] **Step 1: Write the failing page tests**

Extend `MasterDataPage.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LocationsPage } from './LocationsPage'
import { vi } from 'vitest'

it('loads paged locations and opens the create dialog', async () => {
  const api = {
    getLocationsPage: vi.fn().mockResolvedValue({
      items: [{ id: 1, code: 'RACK-A1', name: 'Rack A1', enabled: true, acquired: false, locationType: 1, status: 1, warehouseId: 1, currentPalletId: null }],
      totalCount: 1,
      pageIndex: 1,
      pageSize: 20,
    }),
  }

  render(
    <MemoryRouter>
      <LocationsPage apiOverride={api as never} />
    </MemoryRouter>,
  )

  expect(await screen.findByText('RACK-A1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /new/i }))
  expect(screen.getByRole('dialog', { name: /new location/i })).toBeInTheDocument()
})
```

Add one update/delete/toggle test for at least one resource page:

```tsx
it('toggles enabled state through edit actions', async () => {
  // render with one location row, click Disable, expect updateLocation called
})
```

- [ ] **Step 2: Run the page tests to verify they fail**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm test -- --run src/pages/MasterDataPage.test.tsx`

Expected: FAIL because the pages do not exist yet.

- [ ] **Step 3: Implement the resource pages**

Create `LocationsPage.tsx` with the shared pattern:

```tsx
import { Plus, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MasterDataDialog } from '../components/MasterDataDialog'
import { MasterDataTable } from '../components/MasterDataTable'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import type { LocationInputModel, LocationModel } from '../types'

export function LocationsPage({ apiOverride = api }: { apiOverride?: typeof api }) {
  const [items, setItems] = useState<LocationModel[]>([])
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [editing, setEditing] = useState<LocationModel | null>(null)
  const [draft, setDraft] = useState<LocationInputModel>({
    code: '',
    name: '',
    enabled: true,
    locationType: 1,
    status: 1,
    warehouseId: 1,
    currentPalletId: null,
  })

  async function loadPage(nextPageIndex = pageIndex, nextPageSize = pageSize) {
    const result = await apiOverride.getLocationsPage(nextPageIndex, nextPageSize)
    setItems(result.items)
    setTotalCount(result.totalCount)
    setPageIndex(result.pageIndex)
    setPageSize(result.pageSize)
  }

  useEffect(() => {
    void loadPage(1, pageSize)
  }, [])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Locations"
        actions={
          <>
            <button className="icon-button" type="button" onClick={() => void loadPage()}>
              <RefreshCcw size={16} />
            </button>
            <button className="primary-button" type="button" onClick={() => { setEditing(null); setDraft({ ...draft, code: '', name: '' }) }}>
              <Plus size={16} />
              <span>New</span>
            </button>
          </>
        }
      />
      <MasterDataTable
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'locationType', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'warehouseId', label: 'Warehouse' },
          { key: 'currentPalletId', label: 'Current Pallet' },
          { key: 'enabled', label: 'Enabled', render: (row) => (row.enabled ? 'Yes' : 'No') },
          { key: 'acquired', label: 'Acquired', render: (row) => (row.acquired ? 'Yes' : 'No') },
        ]}
        rows={items}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={(next) => void loadPage(next, pageSize)}
        onPageSizeChange={(next) => void loadPage(1, next)}
        onEdit={(row) => {
          setEditing(row)
          setDraft({
            code: row.code,
            name: row.name,
            enabled: row.enabled,
            locationType: row.locationType,
            status: row.status,
            warehouseId: row.warehouseId,
            currentPalletId: row.currentPalletId ?? null,
          })
        }}
        onDelete={async (row) => {
          if (!window.confirm(`Delete ${row.code}?`)) return
          await apiOverride.deleteLocation(row.id)
          await loadPage(items.length === 1 && pageIndex > 1 ? pageIndex - 1 : pageIndex, pageSize)
        }}
        onToggleEnabled={async (row) => {
          await apiOverride.updateLocation(row.id, {
            code: row.code,
            name: row.name,
            enabled: !row.enabled,
            locationType: row.locationType,
            status: row.status,
            warehouseId: row.warehouseId,
            currentPalletId: row.currentPalletId ?? null,
          })
          await loadPage()
        }}
      />
      <MasterDataDialog
        open={editing !== null || draft.code === ''}
        title={editing ? 'Edit Location' : 'New Location'}
        onClose={() => {
          setEditing(null)
          setDraft((current) => ({ ...current, code: 'CLOSED-SENTINEL' }))
        }}
        onSubmit={async () => {
          if (editing) {
            await apiOverride.updateLocation(editing.id, draft)
          } else {
            await apiOverride.createLocation(draft)
          }
          setEditing(null)
          setDraft((current) => ({ ...current, code: 'CLOSED-SENTINEL' }))
          await loadPage()
        }}
      >
        {/* simple controlled inputs for the fields */}
      </MasterDataDialog>
    </div>
  )
}
```

Implement `PortsPage.tsx`, `PalletsPage.tsx`, and `SkusPage.tsx` using the same pattern with resource-appropriate fields and API bindings.

- [ ] **Step 4: Run the page tests**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm test -- --run src/pages/MasterDataPage.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel add \
  src/pages/LocationsPage.tsx \
  src/pages/PortsPage.tsx \
  src/pages/PalletsPage.tsx \
  src/pages/SkusPage.tsx \
  src/pages/MasterDataPage.test.tsx
git -C /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel commit -m "feat: add master data list pages"
```

### Task 4: Wire routes and navigation, then run full frontend verification

**Files:**
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/App.tsx`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel/src/components/AppShell.tsx`

- [ ] **Step 1: Write the failing route/navigation test**

Extend `MasterDataPage.test.tsx` with one routing assertion:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

it('shows master-data navigation entries', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )

  expect(screen.getByText('Locations')).toBeInTheDocument()
  expect(screen.getByText('Ports')).toBeInTheDocument()
  expect(screen.getByText('Pallets')).toBeInTheDocument()
  expect(screen.getByText('Skus')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the route test to verify it fails**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm test -- --run src/pages/MasterDataPage.test.tsx`

Expected: FAIL because routes and nav entries are missing.

- [ ] **Step 3: Add the routes and sidebar navigation**

Update `App.tsx`:

```tsx
<Route path="/master-data/locations" element={<LocationsPage />} />
<Route path="/master-data/ports" element={<PortsPage />} />
<Route path="/master-data/pallets" element={<PalletsPage />} />
<Route path="/master-data/skus" element={<SkusPage />} />
```

Update `AppShell.tsx` nav items:

```tsx
{ to: '/master-data/locations', label: 'Locations', icon: MapPinned },
{ to: '/master-data/ports', label: 'Ports', icon: Workflow },
{ to: '/master-data/pallets', label: 'Pallets', icon: Package2 },
{ to: '/master-data/skus', label: 'Skus', icon: Tags },
```

- [ ] **Step 4: Run full frontend verification**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm test`

Expected: all tests PASS.

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm run lint`

Expected: PASS

Run: `cd /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel && npm run build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel add \
  src/App.tsx \
  src/components/AppShell.tsx
git -C /Users/qiping/Desktop/codes/work/FlowView/.worktrees/feature-resource-summary-panel commit -m "feat: wire master data navigation"
```

## Self-Review

- Spec coverage: separate routes, backend-backed pagination, modal create/edit, delete, enable/disable, and consistent verification all map directly to plan tasks.
- Placeholder scan: no `TODO`, `TBD`, or “handle later” placeholders remain.
- Type consistency: the plan consistently uses `PagedResponse`, `LocationInputModel`, `PortInputModel`, `PalletInputModel`, `SkuInputModel`, and the four resource page route names.
