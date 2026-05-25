# Resource Summary Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable resource summary panel to the orders page and task execution page so users can see requested vs resolved locations, pallet and SKU state, lock state, rule matches, and resource state transitions.

**Architecture:** Build a shared `ResourceSummaryPanel` plus a small derivation layer in `src/lib` that converts existing `FlowTaskDetail`, order models, and master data into UI-friendly resource summaries. Reuse the same summary vocabulary on orders and execution pages, but allow the execution page to add node-specific `before`/`after` state transitions.

**Tech Stack:** React, TypeScript, existing `FlowView` page/component patterns, Vitest, Testing Library, Vite

---

### Task 1: Extend frontend types for resource summaries

**Files:**
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/src/types.ts`
- Test: `/Users/qiping/Desktop/codes/work/FlowView/src/lib/resourceSummary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { toSelectionSourceLabel } from './resourceSummary'

describe('toSelectionSourceLabel', () => {
  it('returns fallback when requested and resolved locations differ', () => {
    expect(toSelectionSourceLabel('RACK-A1', 'RACK-A2')).toBe('Fallback rule match')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/lib/resourceSummary.test.ts`
Expected: FAIL with module or export not found for `resourceSummary`

- [ ] **Step 3: Write minimal implementation**

```ts
export interface ResourceSummaryField {
  label: string
  value: string
}

export interface ResourceSummaryCard {
  title: string
  fields: ResourceSummaryField[]
}

export interface ExecutionResourceTransition {
  before?: string
  after?: string
}

export function toSelectionSourceLabel(requestedLocation?: string | null, resolvedLocation?: string | null) {
  if (!requestedLocation || !resolvedLocation) {
    return ''
  }

  return requestedLocation === resolvedLocation ? 'Preferred location' : 'Fallback rule match'
}
```

- [ ] **Step 4: Update `/Users/qiping/Desktop/codes/work/FlowView/src/types.ts`**

```ts
export interface ResourceSummaryField {
  label: string
  value: string
}

export interface ResourceSummaryCard {
  title: string
  fields: ResourceSummaryField[]
}

export interface ExecutionResourceTransition {
  before?: string
  after?: string
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/lib/resourceSummary.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView add src/types.ts src/lib/resourceSummary.test.ts src/lib/resourceSummary.ts
git -C /Users/qiping/Desktop/codes/work/FlowView commit -m "feat: add resource summary types"
```

### Task 2: Build resource summary derivation helpers

**Files:**
- Create: `/Users/qiping/Desktop/codes/work/FlowView/src/lib/resourceSummary.ts`
- Test: `/Users/qiping/Desktop/codes/work/FlowView/src/lib/resourceSummary.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import type { FlowTaskDetail, InboundOrderModel, LocationModel, SkuModel } from '../types'
import {
  buildOrderResourceSummary,
  buildExecutionResourceSummary,
} from './resourceSummary'

describe('buildOrderResourceSummary', () => {
  it('shows fallback selection when resolved location differs from the order line', () => {
    const order = {
      id: 1,
      code: 'OUT-1',
      status: 3,
      destination: 'OUT-01',
      lines: [{ id: 1, skuId: 1, quantity: 1, sourceLocationId: 2 }],
    } as InboundOrderModel

    const task = {
      id: 10,
      status: 3,
      availableActions: ['cancel'],
      variableEntities: [
        { id: 'SourceLocationCode', value: '"RACK-A2"' },
        { id: 'SkuCode', value: '"SKU-001"' },
        { id: 'SourcePalletId', value: '1' },
      ],
      resourceDetails: [{ resourceType: 'Backend.Demo#Backend.Demo.Domain.Location', resourceId: '3' }],
      executableDetailModels: [],
    } as unknown as FlowTaskDetail

    const locations = [
      { id: 2, code: 'RACK-A1', name: 'Rack A1', status: 1, acquired: false, enabled: true, locationType: 1, warehouseId: 1 },
      { id: 3, code: 'RACK-A2', name: 'Rack A2', status: 2, acquired: true, enabled: true, locationType: 1, warehouseId: 1 },
    ] as LocationModel[]

    const skus = [{ id: 1, code: 'SKU-001', name: 'Demo Tote', spec: 'Blue / 600x400' }] as SkuModel[]

    const summary = buildOrderResourceSummary('outbound', order as any, task, locations, skus)

    expect(summary?.fields.find(field => field.label === 'Selection Source')?.value).toBe('Fallback rule match')
    expect(summary?.fields.find(field => field.label === 'Resolved Location')?.value).toBe('RACK-A2')
  })
})

describe('buildExecutionResourceSummary', () => {
  it('describes retrieve transitions with pallet release', () => {
    const task = {
      id: 10,
      status: 3,
      variableEntities: [
        { id: 'SourceLocationCode', value: '"RACK-A2"' },
        { id: 'SourcePalletId', value: '1' },
        { id: 'SkuCode', value: '"SKU-001"' },
      ],
      resourceDetails: [
        { resourceType: 'Backend.Demo#Backend.Demo.Domain.Location', resourceId: '3' },
        { resourceType: 'Backend.Demo#Backend.Demo.Domain.Pallet', resourceId: '1' },
      ],
      executableDetailModels: [],
      availableActions: ['cancel'],
    } as unknown as FlowTaskDetail

    const summary = buildExecutionResourceSummary(task, {
      id: 5,
      executableType: 0,
      parentFlowTaskId: 10,
      nodeId: 'Retrieve',
      status: 3,
      acknowledged: false,
      availableActions: ['cancel'],
    })

    expect(summary?.transition?.before).toContain('occupied')
    expect(summary?.transition?.after).toContain('pallet released')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/lib/resourceSummary.test.ts`
Expected: FAIL because `buildOrderResourceSummary` and `buildExecutionResourceSummary` do not exist

- [ ] **Step 3: Write minimal implementation**

```ts
import type {
  ExecutableDetailModel,
  FlowTaskDetail,
  LocationModel,
  OrderKind,
  ResourceSummaryCard,
  ResourceSummaryField,
  SkuModel,
} from '../types'

function readVariable(task: FlowTaskDetail | null, id: string) {
  const raw = task?.variableEntities?.find(variable => variable.id === id)?.value
  if (!raw) return ''
  return raw.startsWith('"') ? JSON.parse(raw) : raw
}

function findLocationByCode(locations: LocationModel[], code: string) {
  return locations.find(location => location.code === code) ?? null
}

export function toSelectionSourceLabel(requestedLocation?: string | null, resolvedLocation?: string | null) {
  if (!requestedLocation || !resolvedLocation) return ''
  return requestedLocation === resolvedLocation ? 'Preferred location' : 'Fallback rule match'
}

export function buildOrderResourceSummary(
  kind: OrderKind,
  order: any,
  task: FlowTaskDetail | null,
  locations: LocationModel[],
  skus: SkuModel[],
): ResourceSummaryCard | null {
  if (!order || !task) return null

  const line = order.lines?.[0]
  const requestedLocation =
    kind === 'inbound'
      ? locations.find(location => location.id === line?.targetLocationId)?.code ?? ''
      : locations.find(location => location.id === line?.sourceLocationId)?.code ?? ''

  const resolvedLocation = kind === 'inbound'
    ? String(readVariable(task, 'TargetLocationCode') || '')
    : String(readVariable(task, 'SourceLocationCode') || '')

  const resolvedLocationModel = findLocationByCode(locations, resolvedLocation)
  const skuCode = String(readVariable(task, 'SkuCode') || '')
  const sku = skus.find(item => item.code === skuCode)
  const palletId = kind === 'inbound'
    ? String(readVariable(task, 'CurrentPalletId') || '')
    : String(readVariable(task, 'SourcePalletId') || '')
  const resourceIds = new Set((task.resourceDetails ?? []).map(detail => detail.resourceId))

  const fields: ResourceSummaryField[] = [
    { label: 'Requested Location', value: requestedLocation || 'Unknown' },
    { label: 'Resolved Location', value: resolvedLocation || 'Unknown' },
    { label: 'Location Status', value: resolvedLocationModel ? locationStatusLabel(resolvedLocationModel.status) : 'Unknown' },
    { label: 'Pallet', value: palletId && palletId !== '0' ? `Pallet #${palletId}` : 'None' },
    { label: 'SKU', value: sku?.code ?? skuCode || 'Unknown' },
    { label: 'Lock State', value: resolvedLocationModel && resourceIds.has(String(resolvedLocationModel.id)) ? 'Locked' : 'Unlocked' },
  ]

  const selectionSource = toSelectionSourceLabel(requestedLocation, resolvedLocation)
  if (selectionSource) {
    fields.push({ label: 'Selection Source', value: selectionSource })
  }

  return { title: 'Warehouse Resources', fields }
}

export function buildExecutionResourceSummary(
  task: FlowTaskDetail | null,
  detail: Pick<ExecutableDetailModel, 'nodeId' | 'status' | 'availableActions' | 'parentFlowTaskId'> | null,
): (ResourceSummaryCard & { transition?: { before?: string; after?: string } }) | null {
  if (!task || !detail?.nodeId) return null

  const sourceLocation = String(readVariable(task, 'SourceLocationCode') || '')
  const targetLocation = String(readVariable(task, 'TargetLocationCode') || '')
  const palletId = String(readVariable(task, 'SourcePalletId') || '')
  const skuCode = String(readVariable(task, 'SkuCode') || '')
  const nodeId = detail.nodeId

  const fields: ResourceSummaryField[] = [
    { label: 'Requested Location', value: sourceLocation || targetLocation || 'Unknown' },
    { label: 'Resolved Location', value: sourceLocation || targetLocation || 'Unknown' },
    { label: 'Pallet', value: palletId && palletId !== '0' ? `Pallet #${palletId}` : 'None' },
    { label: 'SKU', value: skuCode || 'Unknown' },
    { label: 'Lock State', value: detail.availableActions.includes('cancel') ? 'Locked' : 'Unlocked' },
  ]

  let ruleMatch = ''
  let before = ''
  let after = ''

  if (nodeId === 'AcquireTargetLocation') {
    ruleMatch = 'empty-rack-location'
    before = `Requested ${targetLocation || 'Unknown'}`
    after = `Locked ${targetLocation || 'Unknown'}`
  } else if (nodeId === 'AcquireSourceLocation') {
    ruleMatch = 'occupied-rack-location'
    before = `Requested ${sourceLocation || 'Unknown'} for ${skuCode || 'Unknown'}`
    after = `Locked ${sourceLocation || 'Unknown'}`
  } else if (nodeId === 'Store') {
    before = `${targetLocation || 'Unknown'} empty`
    after = `${targetLocation || 'Unknown'} occupied, pallet created`
  } else if (nodeId === 'Retrieve') {
    before = `${sourceLocation || 'Unknown'} occupied, pallet bound`
    after = `${sourceLocation || 'Unknown'} empty, pallet released`
  } else {
    return null
  }

  if (ruleMatch) fields.unshift({ label: 'Rule Match', value: ruleMatch })

  return {
    title: 'Resource Transition',
    fields,
    transition: { before, after },
  }
}

function locationStatusLabel(status: number) {
  switch (status) {
    case 1: return 'Empty'
    case 2: return 'Occupied'
    default: return 'Available'
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/lib/resourceSummary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView add src/lib/resourceSummary.ts src/lib/resourceSummary.test.ts
git -C /Users/qiping/Desktop/codes/work/FlowView commit -m "feat: derive warehouse resource summaries"
```

### Task 3: Create the reusable ResourceSummaryPanel component

**Files:**
- Create: `/Users/qiping/Desktop/codes/work/FlowView/src/components/ResourceSummaryPanel.tsx`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/src/index.css`
- Test: `/Users/qiping/Desktop/codes/work/FlowView/src/components/ResourceSummaryPanel.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResourceSummaryPanel } from './ResourceSummaryPanel'

describe('ResourceSummaryPanel', () => {
  it('renders field labels and before/after transitions', () => {
    render(
      <ResourceSummaryPanel
        summary={{
          title: 'Warehouse Resources',
          fields: [
            { label: 'Resolved Location', value: 'RACK-A2' },
            { label: 'Pallet', value: 'PLT-SEED-RACK-A2' },
          ],
          transition: {
            before: 'RACK-A2 occupied',
            after: 'RACK-A2 empty, pallet released',
          },
        }}
      />,
    )

    expect(screen.getByText('Warehouse Resources')).toBeInTheDocument()
    expect(screen.getByText('Resolved Location')).toBeInTheDocument()
    expect(screen.getByText('RACK-A2')).toBeInTheDocument()
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('RACK-A2 occupied')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/components/ResourceSummaryPanel.test.tsx`
Expected: FAIL because `ResourceSummaryPanel` does not exist

- [ ] **Step 3: Write minimal component**

```tsx
import type { ExecutionResourceTransition, ResourceSummaryCard } from '../types'

interface ResourceSummaryPanelProps {
  summary: (ResourceSummaryCard & { transition?: ExecutionResourceTransition }) | null
}

export function ResourceSummaryPanel({ summary }: ResourceSummaryPanelProps) {
  if (!summary) return null

  return (
    <section className="resource-summary-panel">
      <div className="resource-summary-header">
        <h3>{summary.title}</h3>
      </div>
      <dl className="resource-summary-grid">
        {summary.fields.map(field => (
          <div key={field.label} className="resource-summary-item">
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      {summary.transition ? (
        <div className="resource-summary-transition">
          {summary.transition.before ? (
            <div>
              <span>Before</span>
              <p>{summary.transition.before}</p>
            </div>
          ) : null}
          {summary.transition.after ? (
            <div>
              <span>After</span>
              <p>{summary.transition.after}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
```

- [ ] **Step 4: Add minimal styles**

```css
.resource-summary-panel {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.32);
}

.resource-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin: 0;
}

.resource-summary-item dt {
  font-size: 12px;
  color: rgba(226, 232, 240, 0.7);
}

.resource-summary-item dd {
  margin: 4px 0 0;
  font-size: 14px;
  color: #f8fafc;
}

.resource-summary-transition {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/components/ResourceSummaryPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView add src/components/ResourceSummaryPanel.tsx src/components/ResourceSummaryPanel.test.tsx src/index.css
git -C /Users/qiping/Desktop/codes/work/FlowView commit -m "feat: add resource summary panel"
```

### Task 4: Render resource summaries on the orders page

**Files:**
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/src/pages/OrdersPage.tsx`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/src/lib/api.ts`
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/src/types.ts`
- Test: `/Users/qiping/Desktop/codes/work/FlowView/src/pages/OrdersPage.test.tsx`

- [ ] **Step 1: Write the failing page test**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { OrdersPage } from './OrdersPage'

vi.mock('../lib/api', () => ({
  api: {
    getSkus: vi.fn().mockResolvedValue({ items: [{ id: 1, code: 'SKU-001', name: 'Demo Tote', spec: 'Blue / 600x400' }] }),
    getLocations: vi.fn().mockResolvedValue({
      items: [
        { id: 2, code: 'RACK-A1', name: 'Rack A1', enabled: true, acquired: false, locationType: 1, status: 1, warehouseId: 1 },
        { id: 3, code: 'RACK-A2', name: 'Rack A2', enabled: true, acquired: true, locationType: 1, status: 2, warehouseId: 1 },
      ],
    }),
    getInboundOrders: vi.fn().mockResolvedValue({ items: [{ id: 1, code: 'IN-1', status: 3, source: 'IN-01', lines: [{ id: 1, skuId: 1, quantity: 1, targetLocationId: 2 }], flowTaskId: 10 }] }),
    getFlowTask: vi.fn().mockResolvedValue({
      id: 10,
      status: 3,
      availableActions: ['cancel'],
      variableEntities: [
        { id: 'TargetLocationCode', value: '"RACK-A2"' },
        { id: 'SkuCode', value: '"SKU-001"' },
      ],
      resourceDetails: [{ resourceType: 'Backend.Demo#Backend.Demo.Domain.Location', resourceId: '3' }],
      executableDetailModels: [],
    }),
  },
}))

describe('OrdersPage resource summary', () => {
  it('shows requested vs resolved location for the selected order', async () => {
    render(
      <MemoryRouter>
        <OrdersPage kind="inbound" />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Warehouse Resources')).toBeInTheDocument()
    expect(screen.getByText('Requested Location')).toBeInTheDocument()
    expect(screen.getByText('Resolved Location')).toBeInTheDocument()
    expect(screen.getByText('Fallback rule match')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/pages/OrdersPage.test.tsx`
Expected: FAIL because the resource panel is not rendered

- [ ] **Step 3: Integrate the resource panel into `OrdersPage.tsx`**

```tsx
import { ResourceSummaryPanel } from '../components/ResourceSummaryPanel'
import { buildOrderResourceSummary } from '../lib/resourceSummary'

const selectedResourceSummary = buildOrderResourceSummary(
  kind,
  selectedOrder,
  selectedTask,
  locations,
  skus,
)

<ResourceSummaryPanel summary={selectedResourceSummary} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/pages/OrdersPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView add src/pages/OrdersPage.tsx src/pages/OrdersPage.test.tsx src/lib/api.ts src/types.ts
git -C /Users/qiping/Desktop/codes/work/FlowView commit -m "feat: show resource summaries on orders"
```

### Task 5: Render execution resource summaries on the task execution page

**Files:**
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/src/pages/TaskExecutionPage.tsx`
- Test: `/Users/qiping/Desktop/codes/work/FlowView/src/pages/TaskExecutionPage.test.tsx`

- [ ] **Step 1: Write the failing page test**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TaskExecutionPage } from './TaskExecutionPage'

vi.mock('../lib/api', () => ({
  api: {
    getFlowTask: vi.fn().mockResolvedValue({
      id: 10,
      status: 3,
      availableActions: ['cancel'],
      variableEntities: [
        { id: 'SourceLocationCode', value: '"RACK-A2"' },
        { id: 'SourcePalletId', value: '1' },
        { id: 'SkuCode', value: '"SKU-001"' },
      ],
      resourceDetails: [
        { resourceType: 'Backend.Demo#Backend.Demo.Domain.Location', resourceId: '3' },
        { resourceType: 'Backend.Demo#Backend.Demo.Domain.Pallet', resourceId: '1' },
      ],
      executableDetailModels: [
        { id: 5, executableType: 0, nodeId: 'Retrieve', status: 3, acknowledged: false, parentFlowTaskId: 10, availableActions: ['cancel'] },
      ],
    }),
  },
}))

describe('TaskExecutionPage resource summary', () => {
  it('shows rule and before/after transition for the selected node', async () => {
    render(
      <MemoryRouter initialEntries={['/tasks/10']}>
        <Routes>
          <Route path="/tasks/:taskId" element={<TaskExecutionPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Resource Transition')).toBeInTheDocument()
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('After')).toBeInTheDocument()
    expect(screen.getByText('pallet released')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/pages/TaskExecutionPage.test.tsx`
Expected: FAIL because the execution page does not show the resource summary

- [ ] **Step 3: Integrate the resource panel into `TaskExecutionPage.tsx`**

```tsx
import { ResourceSummaryPanel } from '../components/ResourceSummaryPanel'
import { buildExecutionResourceSummary } from '../lib/resourceSummary'

const executionResourceSummary = buildExecutionResourceSummary(task, selectedDetail)

<ResourceSummaryPanel summary={executionResourceSummary} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/qiping/Desktop/codes/work/FlowView && npm test -- --run src/pages/TaskExecutionPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView add src/pages/TaskExecutionPage.tsx src/pages/TaskExecutionPage.test.tsx
git -C /Users/qiping/Desktop/codes/work/FlowView commit -m "feat: show resource summaries in execution view"
```

### Task 6: Full verification and README note if needed

**Files:**
- Modify: `/Users/qiping/Desktop/codes/work/FlowView/README.md` (only if startup or behavior notes need clarification)

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd /Users/qiping/Desktop/codes/work/FlowView
npm test -- --run src/lib/resourceSummary.test.ts src/components/ResourceSummaryPanel.test.tsx src/pages/OrdersPage.test.tsx src/pages/TaskExecutionPage.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run full frontend validation**

Run:

```bash
cd /Users/qiping/Desktop/codes/work/FlowView
npm test
npm run lint
npm run build
```

Expected: all PASS

- [ ] **Step 3: Update README only if the new resource summaries need a demo note**

```md
- Orders now show requested vs resolved warehouse resources
- Execution details now show resource transitions for acquire/store/retrieve nodes
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/qiping/Desktop/codes/work/FlowView add README.md src
git -C /Users/qiping/Desktop/codes/work/FlowView commit -m "test: verify resource summary workflow"
```

## Self-Review

- Spec coverage:
  - order resource summaries: covered in Task 4
  - execution resource summaries: covered in Task 5
  - reusable panel: covered in Task 3
  - selection source and transition logic: covered in Task 2
- Placeholder scan: no `TODO` or vague implementation steps remain
- Type consistency:
  - `ResourceSummaryCard`, `ExecutionResourceTransition`, `buildOrderResourceSummary`, `buildExecutionResourceSummary`, and `ResourceSummaryPanel` are defined consistently across tasks
