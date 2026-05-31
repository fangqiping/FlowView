# Flow Branch Route Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FlowView Inspector support for editing outgoing direct, condition, and switch routes while keeping ReactFlow edges synchronized with FlowEngine draft JSON.

**Architecture:** Store FlowEngine route semantics in ReactFlow edge `data`, keep draft serialization in `src/lib/flowDraft.ts`, and add a small route editor helper for Inspector state transitions. The Flow Editor UI derives the selected node's outgoing route from current edges, so canvas changes and Inspector changes stay in one source of truth.

**Tech Stack:** React, TypeScript, ReactFlow, Vitest, Testing Library.

---

## File Structure

- Modify `src/lib/flowDraft.ts`
  - Add typed route edge metadata.
  - Convert FlowEngine `DraftRoute.kind` and `condition` into labeled ReactFlow edges.
  - Serialize route edge metadata back to `DraftRoute`.
  - Keep canvas-created edges as direct route edges.
- Modify `src/lib/flowDraft.test.ts`
  - Cover condition and switch route round-tripping.
- Create `src/lib/routeEditor.ts`
  - Convert outgoing edges for one source node into Inspector-friendly route state.
  - Replace one source node's outgoing edges when Inspector fields change.
- Create `src/lib/routeEditor.test.ts`
  - Cover condition route detection and replacement.
- Modify `src/pages/FlowEditorPage.tsx`
  - Add `Outgoing routes` Inspector section.
  - Add route mode, condition variable, target selectors, and switch case controls.
- Modify `src/pages/FlowEditorPage.test.tsx`
  - Cover editing a condition route and saving expected draft JSON.
- Modify `src/index.css`
  - Add compact route editor layout classes consistent with current Inspector styling.

---

### Task 1: Route Metadata Round Trip

**Files:**
- Modify: `src/lib/flowDraft.ts`
- Test: `src/lib/flowDraft.test.ts`

- [ ] **Step 1: Write failing route metadata tests**

Append these tests to `src/lib/flowDraft.test.ts`:

```typescript
import { buildDraftDocument, buildFlowGraph, type FlowEdge, ROOT_NODE_ID } from './flowDraft'
import type { DraftDocument, DraftVariable } from '../types'

describe('flowDraft branch routes', () => {
  const variables: DraftVariable[] = [
    { id: 'CanStore', type: 'bool', usage: 'inputOutput', initialValue: true },
    { id: 'BranchIndex', type: 'int', usage: 'inputOutput', initialValue: 0 },
  ]

  it('converts condition routes into labeled true and false edges', () => {
    const document: DraftDocument = {
      id: 'BranchFlow',
      variables,
      nodes: [
        baseNode('CheckInventory'),
        baseNode('StorePallet'),
        baseNode('RejectPallet'),
      ],
      routes: [
        { type: 0, source: 'CheckInventory', targets: ['StorePallet', 'RejectPallet'], kind: 1, condition: 'CanStore' },
      ],
    }

    const { edges } = buildFlowGraph(document)

    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'CheckInventory',
        target: 'StorePallet',
        label: 'CanStore: true',
        data: expect.objectContaining({ routeKind: 'condition', routeCondition: 'CanStore', routeTargetIndex: 0, routeTargetRole: 'true' }),
      }),
      expect.objectContaining({
        source: 'CheckInventory',
        target: 'RejectPallet',
        label: 'CanStore: false',
        data: expect.objectContaining({ routeKind: 'condition', routeCondition: 'CanStore', routeTargetIndex: 1, routeTargetRole: 'false' }),
      }),
    ]))
  })

  it('serializes condition and switch route edge metadata back to draft routes', () => {
    const nodes = buildFlowGraph({
      id: 'BranchFlow',
      variables,
      nodes: [baseNode('CheckInventory'), baseNode('StorePallet'), baseNode('RejectPallet'), baseNode('ManualReview')],
      routes: [],
    }).nodes
    const edges: FlowEdge[] = [
      {
        id: 'condition-true',
        source: 'CheckInventory',
        target: 'StorePallet',
        label: 'CanStore: true',
        data: { routeKind: 'condition', routeCondition: 'CanStore', routeTargetIndex: 0, routeTargetRole: 'true' },
      },
      {
        id: 'condition-false',
        source: 'CheckInventory',
        target: 'RejectPallet',
        label: 'CanStore: false',
        data: { routeKind: 'condition', routeCondition: 'CanStore', routeTargetIndex: 1, routeTargetRole: 'false' },
      },
      {
        id: 'switch-0',
        source: 'RejectPallet',
        target: 'ManualReview',
        label: 'BranchIndex: 0',
        data: { routeKind: 'switch', routeCondition: 'BranchIndex', routeTargetIndex: 0, routeTargetRole: 'case' },
      },
      {
        id: 'switch-1',
        source: 'RejectPallet',
        target: 'StorePallet',
        label: 'BranchIndex: 1',
        data: { routeKind: 'switch', routeCondition: 'BranchIndex', routeTargetIndex: 1, routeTargetRole: 'case' },
      },
      {
        id: 'root-direct',
        source: ROOT_NODE_ID,
        target: 'CheckInventory',
        data: { routeKind: 'direct', routeTargetIndex: 0 },
      },
    ]

    const draft = buildDraftDocument('branch-flow', 'Branch Flow', variables, nodes, edges)

    expect(draft.routes).toEqual(expect.arrayContaining([
      { type: 0, source: 'CheckInventory', targets: ['StorePallet', 'RejectPallet'], kind: 1, condition: 'CanStore' },
      { type: 0, source: 'RejectPallet', targets: ['ManualReview', 'StorePallet'], kind: 2, condition: 'BranchIndex' },
      { type: 0, source: ROOT_NODE_ID, targets: ['CheckInventory'], kind: 0 },
    ]))
  })
})

function baseNode(id: string) {
  return {
    id,
    nodeType: 'Operation' as const,
    description: '',
    shouldThrowOnFailed: true,
    shouldThrowOnCanceled: true,
    inputs: [],
    outputs: [],
    resourceOutputs: [],
    consoleId: 'FunctionConsole',
    operationTaskType: 'Backend.Demo.FunctionOperationTask',
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run src/lib/flowDraft.test.ts
```

Expected: FAIL because `FlowEdge` has no route metadata type and `buildFlowGraph` labels condition edges as the raw condition only.

- [ ] **Step 3: Add route metadata implementation**

In `src/lib/flowDraft.ts`, replace `export type FlowEdge = Edge` with:

```typescript
export type RouteKind = 'direct' | 'condition' | 'switch'
export type RouteTargetRole = 'true' | 'false' | 'case'

export interface FlowEdgeData extends Record<string, unknown> {
  routeKind: RouteKind
  routeCondition?: string
  routeTargetIndex: number
  routeTargetRole?: RouteTargetRole
}

export type FlowEdge = Edge<FlowEdgeData>
```

Add these helpers near `ROOT_NODE_ID`:

```typescript
const ROUTE_KIND_TO_DRAFT_KIND: Record<RouteKind, DraftRoute['kind']> = {
  direct: 0,
  condition: 1,
  switch: 2,
}

function toRouteKind(kind: DraftRoute['kind'] | undefined): RouteKind {
  if (kind === 1) {
    return 'condition'
  }
  if (kind === 2) {
    return 'switch'
  }
  return 'direct'
}

function routeLabel(routeKind: RouteKind, condition: string | null | undefined, targetIndex: number): string | undefined {
  if (routeKind === 'condition' && condition) {
    return `${condition}: ${targetIndex === 0 ? 'true' : 'false'}`
  }
  if (routeKind === 'switch' && condition) {
    return `${condition}: ${targetIndex}`
  }
  return undefined
}

function routeTargetRole(routeKind: RouteKind, targetIndex: number): RouteTargetRole | undefined {
  if (routeKind === 'condition') {
    return targetIndex === 0 ? 'true' : 'false'
  }
  if (routeKind === 'switch') {
    return 'case'
  }
  return undefined
}

export function createRouteEdge(
  source: string,
  target: string,
  routeKind: RouteKind,
  routeTargetIndex: number,
  routeCondition?: string | null,
): FlowEdge {
  const condition = routeKind === 'direct' ? undefined : routeCondition ?? undefined
  return {
    id: `${source}-${target}-${routeKind}-${condition ?? 'direct'}-${routeTargetIndex}`,
    source,
    target,
    label: routeLabel(routeKind, condition, routeTargetIndex),
    animated: source === ROOT_NODE_ID,
    data: {
      routeKind,
      routeCondition: condition,
      routeTargetIndex,
      routeTargetRole: routeTargetRole(routeKind, routeTargetIndex),
    },
  }
}

function edgeRouteData(edge: FlowEdge, fallbackIndex: number): FlowEdgeData {
  return {
    routeKind: edge.data?.routeKind ?? 'direct',
    routeCondition: edge.data?.routeCondition,
    routeTargetIndex: Number.isFinite(edge.data?.routeTargetIndex) ? Number(edge.data?.routeTargetIndex) : fallbackIndex,
    routeTargetRole: edge.data?.routeTargetRole,
  }
}
```

Update the `buildFlowGraph` route mapping to use `createRouteEdge`:

```typescript
const edges: FlowEdge[] = document.routes.flatMap((route) => {
  const routeKind = toRouteKind(route.kind)
  return route.targets.map((target, targetIndex) =>
    createRouteEdge(route.source, target, routeKind, targetIndex, route.condition),
  )
})
```

Replace the `routes` reducer inside `buildDraftDocument` with:

```typescript
const routeGroups = edges.reduce<Record<string, { source: string; routeKind: RouteKind; routeCondition?: string; targets: Array<{ target: string; index: number }> }>>((acc, edge, fallbackIndex) => {
  const data = edgeRouteData(edge, fallbackIndex)
  const routeCondition = data.routeKind === 'direct' ? undefined : data.routeCondition
  const key = `${edge.source}:${data.routeKind}:${routeCondition ?? ''}`
  if (!acc[key]) {
    acc[key] = {
      source: edge.source,
      routeKind: data.routeKind,
      routeCondition,
      targets: [],
    }
  }
  acc[key].targets.push({ target: edge.target, index: data.routeTargetIndex })
  return acc
}, {})

const routes: DraftRoute[] = Object.values(routeGroups).map((group) => {
  const orderedTargets = group.targets
    .sort((left, right) => left.index - right.index)
    .map((item) => item.target)

  return {
    type: 0,
    source: group.source,
    targets: orderedTargets,
    kind: ROUTE_KIND_TO_DRAFT_KIND[group.routeKind],
    ...(group.routeKind === 'direct' ? {} : { condition: group.routeCondition ?? '' }),
  }
})
```

Update `connectEdges`:

```typescript
export function connectEdges(edges: FlowEdge[], connection: Connection): FlowEdge[] {
  if (!connection.source || !connection.target) {
    return edges
  }

  const nextIndex = edges.filter((edge) => edge.source === connection.source).length
  return addEdge(
    createRouteEdge(connection.source, connection.target, 'direct', nextIndex),
    edges,
  )
}
```

- [ ] **Step 4: Run tests to verify green**

Run:

```bash
npm test -- --run src/lib/flowDraft.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flowDraft.ts src/lib/flowDraft.test.ts
git commit -m "feat: round trip branch route edges"
```

---

### Task 2: Route Editor Helper

**Files:**
- Create: `src/lib/routeEditor.ts`
- Test: `src/lib/routeEditor.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/lib/routeEditor.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { createRouteEdge } from './flowDraft'
import { getOutgoingRoute, replaceOutgoingRoute } from './routeEditor'

describe('routeEditor', () => {
  it('reads condition outgoing routes from edge metadata', () => {
    const route = getOutgoingRoute([
      createRouteEdge('CheckInventory', 'StorePallet', 'condition', 0, 'CanStore'),
      createRouteEdge('CheckInventory', 'RejectPallet', 'condition', 1, 'CanStore'),
      createRouteEdge('OtherNode', 'StorePallet', 'direct', 0),
    ], 'CheckInventory')

    expect(route).toEqual({
      mode: 'condition',
      condition: 'CanStore',
      directTargets: [],
      trueTarget: 'StorePallet',
      falseTarget: 'RejectPallet',
      switchTargets: [],
    })
  })

  it('replaces one node outgoing route without touching other sources', () => {
    const edges = replaceOutgoingRoute([
      createRouteEdge('CheckInventory', 'OldTarget', 'direct', 0),
      createRouteEdge('OtherNode', 'StorePallet', 'direct', 0),
    ], 'CheckInventory', {
      mode: 'switch',
      condition: 'BranchIndex',
      directTargets: [],
      trueTarget: '',
      falseTarget: '',
      switchTargets: ['ManualReview', 'RejectPallet'],
    })

    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'OtherNode', target: 'StorePallet' }),
      expect.objectContaining({ source: 'CheckInventory', target: 'ManualReview', label: 'BranchIndex: 0' }),
      expect.objectContaining({ source: 'CheckInventory', target: 'RejectPallet', label: 'BranchIndex: 1' }),
    ]))
    expect(edges.some((edge) => edge.target === 'OldTarget')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run src/lib/routeEditor.test.ts
```

Expected: FAIL because `src/lib/routeEditor.ts` does not exist.

- [ ] **Step 3: Implement route editor helper**

Create `src/lib/routeEditor.ts`:

```typescript
import { createRouteEdge, type FlowEdge, type RouteKind } from './flowDraft'

export type OutgoingRouteMode = RouteKind

export interface OutgoingRouteState {
  mode: OutgoingRouteMode
  condition: string
  directTargets: string[]
  trueTarget: string
  falseTarget: string
  switchTargets: string[]
}

export function emptyOutgoingRoute(mode: OutgoingRouteMode = 'direct'): OutgoingRouteState {
  return {
    mode,
    condition: '',
    directTargets: [],
    trueTarget: '',
    falseTarget: '',
    switchTargets: [],
  }
}

export function getOutgoingRoute(edges: FlowEdge[], sourceId: string): OutgoingRouteState {
  const outgoing = edges
    .filter((edge) => edge.source === sourceId)
    .sort((left, right) => (left.data?.routeTargetIndex ?? 0) - (right.data?.routeTargetIndex ?? 0))

  if (outgoing.length === 0) {
    return emptyOutgoingRoute()
  }

  const first = outgoing[0]
  const mode = first.data?.routeKind ?? 'direct'
  const condition = first.data?.routeCondition ?? ''

  if (mode === 'condition') {
    return {
      mode,
      condition,
      directTargets: [],
      trueTarget: outgoing[0]?.target ?? '',
      falseTarget: outgoing[1]?.target ?? '',
      switchTargets: [],
    }
  }

  if (mode === 'switch') {
    return {
      mode,
      condition,
      directTargets: [],
      trueTarget: '',
      falseTarget: '',
      switchTargets: outgoing.map((edge) => edge.target),
    }
  }

  return {
    mode: 'direct',
    condition: '',
    directTargets: outgoing.map((edge) => edge.target),
    trueTarget: '',
    falseTarget: '',
    switchTargets: [],
  }
}

export function replaceOutgoingRoute(edges: FlowEdge[], sourceId: string, route: OutgoingRouteState): FlowEdge[] {
  const retained = edges.filter((edge) => edge.source !== sourceId)
  return [
    ...retained,
    ...createOutgoingEdges(sourceId, route),
  ]
}

function createOutgoingEdges(sourceId: string, route: OutgoingRouteState): FlowEdge[] {
  if (route.mode === 'condition') {
    return [route.trueTarget, route.falseTarget]
      .filter(Boolean)
      .map((target, index) => createRouteEdge(sourceId, target, 'condition', index, route.condition))
  }

  if (route.mode === 'switch') {
    return route.switchTargets
      .filter(Boolean)
      .map((target, index) => createRouteEdge(sourceId, target, 'switch', index, route.condition))
  }

  return route.directTargets
    .filter(Boolean)
    .map((target, index) => createRouteEdge(sourceId, target, 'direct', index))
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
npm test -- --run src/lib/routeEditor.test.ts src/lib/flowDraft.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routeEditor.ts src/lib/routeEditor.test.ts
git commit -m "feat: add outgoing route editor helpers"
```

---

### Task 3: Inspector Condition Route Editing

**Files:**
- Modify: `src/pages/FlowEditorPage.tsx`
- Modify: `src/pages/FlowEditorPage.test.tsx`

- [ ] **Step 1: Write failing Inspector test**

Append this test to `src/pages/FlowEditorPage.test.tsx` inside the existing `describe('FlowEditorPage subflows', () => { ... })` block:

```typescript
  it('edits a selected node condition route and saves branch metadata', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      subFlowTemplates: [],
      variableTypes: [],
      expressionOperators: [],
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'branch-flow',
      name: 'Branch Flow',
      revision: 3,
      updatedAt: '',
      draftDocumentJson: JSON.stringify({
        id: 'BranchFlow',
        variables: [
          { id: 'CanStore', type: 'bool', usage: 'inputOutput', initialValue: true },
          { id: 'BranchIndex', type: 'int', usage: 'inputOutput', initialValue: 0 },
        ],
        nodes: [
          baseDraftNode('CheckInventory'),
          baseDraftNode('StorePallet'),
          baseDraftNode('RejectPallet'),
        ],
        routes: [
          { type: 0, source: 'CheckInventory', targets: ['StorePallet'], kind: 0 },
        ],
      }),
    })
    vi.mocked(api.saveFlowDraft).mockResolvedValue({
      code: 'branch-flow',
      name: 'Branch Flow',
      revision: 4,
      updatedAt: '',
      draftDocumentJson: '{}',
    })

    render(
      <MemoryRouter initialEntries={['/flows/branch-flow/editor']}>
        <Routes>
          <Route path="/flows/:code/editor" element={<FlowEditorPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Outgoing routes')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Route mode'), { target: { value: 'condition' } })
    fireEvent.change(screen.getByLabelText('Condition variable'), { target: { value: 'CanStore' } })
    fireEvent.change(screen.getByLabelText('True target'), { target: { value: 'StorePallet' } })
    fireEvent.change(screen.getByLabelText('False target'), { target: { value: 'RejectPallet' } })
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => expect(api.saveFlowDraft).toHaveBeenCalled())
    const saveInput = vi.mocked(api.saveFlowDraft).mock.calls[0][1]
    const savedDocument = JSON.parse(saveInput.draftDocumentJson)
    expect(savedDocument.routes).toEqual(expect.arrayContaining([
      { type: 0, source: 'CheckInventory', targets: ['StorePallet', 'RejectPallet'], kind: 1, condition: 'CanStore' },
    ]))
  })
```

Add this helper near `renderEditor()`:

```typescript
function baseDraftNode(id: string) {
  return {
    id,
    nodeType: 'Operation',
    description: '',
    shouldThrowOnFailed: true,
    shouldThrowOnCanceled: true,
    inputs: [],
    outputs: [],
    resourceOutputs: [],
    consoleId: 'FunctionConsole',
    operationTaskType: 'Backend.Demo.FunctionOperationTask',
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run src/pages/FlowEditorPage.test.tsx
```

Expected: FAIL because `Outgoing routes` and route controls are not rendered.

- [ ] **Step 3: Add Inspector route editing logic**

In `src/pages/FlowEditorPage.tsx`, add imports:

```typescript
import { emptyOutgoingRoute, getOutgoingRoute, replaceOutgoingRoute, type OutgoingRouteMode, type OutgoingRouteState } from '../lib/routeEditor'
```

Add derived state after `selectedSubFlowCandidate`:

```typescript
  const selectedOutgoingRoute = useMemo(
    () => selectedNode ? getOutgoingRoute(edges as FlowEdge[], selectedNode.id) : emptyOutgoingRoute(),
    [edges, selectedNode],
  )
  const editableTargetNodes = useMemo(
    () => nodes.filter((node) => node.id !== selectedNode?.id),
    [nodes, selectedNode],
  )
  const boolVariables = useMemo(
    () => variables.filter((variable) => variable.type.toLowerCase() === 'bool' || variable.type.toLowerCase() === 'boolean'),
    [variables],
  )
  const intVariables = useMemo(
    () => variables.filter((variable) => variable.type.toLowerCase() === 'int' || variable.type.toLowerCase() === 'int32'),
    [variables],
  )
```

Add update functions near `removeSelectedNode`:

```typescript
  function updateSelectedOutgoingRoute(patch: Partial<OutgoingRouteState>) {
    if (!selectedNode) {
      return
    }

    const nextRoute = normalizeOutgoingRoute({ ...selectedOutgoingRoute, ...patch })
    setEdges((current) => replaceOutgoingRoute(current as FlowEdge[], selectedNode.id, nextRoute))
  }

  function updateRouteMode(mode: OutgoingRouteMode) {
    if (mode === 'condition') {
      updateSelectedOutgoingRoute({
        mode,
        condition: boolVariables[0]?.id ?? '',
        trueTarget: selectedOutgoingRoute.directTargets[0] ?? '',
        falseTarget: '',
        directTargets: [],
        switchTargets: [],
      })
      return
    }

    if (mode === 'switch') {
      updateSelectedOutgoingRoute({
        mode,
        condition: intVariables[0]?.id ?? '',
        switchTargets: selectedOutgoingRoute.directTargets.length ? selectedOutgoingRoute.directTargets : [''],
        directTargets: [],
        trueTarget: '',
        falseTarget: '',
      })
      return
    }

    updateSelectedOutgoingRoute({
      mode,
      condition: '',
      directTargets: selectedOutgoingRoute.trueTarget ? [selectedOutgoingRoute.trueTarget] : selectedOutgoingRoute.switchTargets,
      trueTarget: '',
      falseTarget: '',
      switchTargets: [],
    })
  }

  function normalizeOutgoingRoute(route: OutgoingRouteState): OutgoingRouteState {
    if (route.mode === 'condition') {
      return { ...route, directTargets: [], switchTargets: [] }
    }
    if (route.mode === 'switch') {
      return { ...route, directTargets: [], trueTarget: '', falseTarget: '' }
    }
    return { ...route, condition: '', trueTarget: '', falseTarget: '', switchTargets: [] }
  }

  function updateSwitchTarget(index: number, target: string) {
    updateSelectedOutgoingRoute({
      switchTargets: selectedOutgoingRoute.switchTargets.map((item, itemIndex) => itemIndex === index ? target : item),
    })
  }

  function appendSwitchTarget() {
    updateSelectedOutgoingRoute({ switchTargets: [...selectedOutgoingRoute.switchTargets, ''] })
  }

  function removeSwitchTarget(index: number) {
    updateSelectedOutgoingRoute({
      switchTargets: selectedOutgoingRoute.switchTargets.filter((_, itemIndex) => itemIndex !== index),
    })
  }
```

Add the `Outgoing routes` section inside the selected node block, after the node metadata form and before the subflow contract section:

```tsx
              <div className="library-section route-editor-section">
                <div className="panel-header nested">
                  <h4>Outgoing routes</h4>
                  <span>{selectedOutgoingRoute.mode}</span>
                </div>
                <div className="route-editor-grid">
                  <label>
                    <span>Route mode</span>
                    <select
                      aria-label="Route mode"
                      value={selectedOutgoingRoute.mode}
                      onChange={(event) => updateRouteMode(event.target.value as OutgoingRouteMode)}
                    >
                      <option value="direct">Direct</option>
                      <option value="condition">Condition</option>
                      <option value="switch">Switch</option>
                    </select>
                  </label>
                  {selectedOutgoingRoute.mode === 'condition' ? (
                    <>
                      <label>
                        <span>Condition variable</span>
                        <select
                          aria-label="Condition variable"
                          value={selectedOutgoingRoute.condition}
                          onChange={(event) => updateSelectedOutgoingRoute({ condition: event.target.value })}
                        >
                          <option value="">Select bool variable</option>
                          {boolVariables.map((variable) => (
                            <option key={variable.id} value={variable.id}>{variable.id}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>True target</span>
                        <select
                          aria-label="True target"
                          value={selectedOutgoingRoute.trueTarget}
                          onChange={(event) => updateSelectedOutgoingRoute({ trueTarget: event.target.value })}
                        >
                          <option value="">No true target</option>
                          {editableTargetNodes.map((node) => (
                            <option key={node.id} value={node.id}>{node.id}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>False target</span>
                        <select
                          aria-label="False target"
                          value={selectedOutgoingRoute.falseTarget}
                          onChange={(event) => updateSelectedOutgoingRoute({ falseTarget: event.target.value })}
                        >
                          <option value="">No false target</option>
                          {editableTargetNodes.map((node) => (
                            <option key={node.id} value={node.id}>{node.id}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                  {selectedOutgoingRoute.mode === 'direct' ? (
                    <label>
                      <span>Target</span>
                      <select
                        aria-label="Direct target"
                        value={selectedOutgoingRoute.directTargets[0] ?? ''}
                        onChange={(event) => updateSelectedOutgoingRoute({ directTargets: event.target.value ? [event.target.value] : [] })}
                      >
                        <option value="">No target</option>
                        {editableTargetNodes.map((node) => (
                          <option key={node.id} value={node.id}>{node.id}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {selectedOutgoingRoute.mode === 'switch' ? (
                    <>
                      <label>
                        <span>Switch variable</span>
                        <select
                          aria-label="Switch variable"
                          value={selectedOutgoingRoute.condition}
                          onChange={(event) => updateSelectedOutgoingRoute({ condition: event.target.value })}
                        >
                          <option value="">Select int variable</option>
                          {intVariables.map((variable) => (
                            <option key={variable.id} value={variable.id}>{variable.id}</option>
                          ))}
                        </select>
                      </label>
                      <div className="route-case-list">
                        {selectedOutgoingRoute.switchTargets.map((target, index) => (
                          <label key={`${index}-${target}`}>
                            <span>Case {index}</span>
                            <select
                              aria-label={`Case ${index} target`}
                              value={target}
                              onChange={(event) => updateSwitchTarget(index, event.target.value)}
                            >
                              <option value="">No target</option>
                              {editableTargetNodes.map((node) => (
                                <option key={node.id} value={node.id}>{node.id}</option>
                              ))}
                            </select>
                            <button className="icon-button" type="button" aria-label={`Remove case ${index}`} onClick={() => removeSwitchTarget(index)}>
                              <Trash2 size={16} />
                            </button>
                          </label>
                        ))}
                        <button className="secondary-button" type="button" onClick={appendSwitchTarget}>
                          <Plus size={16} />
                          <span>Add case</span>
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
```

- [ ] **Step 4: Run Inspector test**

Run:

```bash
npm test -- --run src/pages/FlowEditorPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/FlowEditorPage.tsx src/pages/FlowEditorPage.test.tsx
git commit -m "feat: edit outgoing condition routes"
```

---

### Task 4: Switch UI Coverage And Styling

**Files:**
- Modify: `src/pages/FlowEditorPage.test.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write failing switch UI test**

Append this test to `src/pages/FlowEditorPage.test.tsx`:

```typescript
  it('edits switch routes and keeps ordered case targets', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      subFlowTemplates: [],
      variableTypes: [],
      expressionOperators: [],
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'switch-flow',
      name: 'Switch Flow',
      revision: 1,
      updatedAt: '',
      draftDocumentJson: JSON.stringify({
        id: 'SwitchFlow',
        variables: [
          { id: 'BranchIndex', type: 'int', usage: 'inputOutput', initialValue: 0 },
        ],
        nodes: [
          baseDraftNode('DecideRoute'),
          baseDraftNode('LaneA'),
          baseDraftNode('LaneB'),
        ],
        routes: [],
      }),
    })
    vi.mocked(api.saveFlowDraft).mockResolvedValue({
      code: 'switch-flow',
      name: 'Switch Flow',
      revision: 2,
      updatedAt: '',
      draftDocumentJson: '{}',
    })

    render(
      <MemoryRouter initialEntries={['/flows/switch-flow/editor']}>
        <Routes>
          <Route path="/flows/:code/editor" element={<FlowEditorPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Outgoing routes')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Route mode'), { target: { value: 'switch' } })
    fireEvent.change(screen.getByLabelText('Switch variable'), { target: { value: 'BranchIndex' } })
    fireEvent.change(screen.getByLabelText('Case 0 target'), { target: { value: 'LaneA' } })
    fireEvent.click(screen.getByRole('button', { name: /add case/i }))
    fireEvent.change(screen.getByLabelText('Case 1 target'), { target: { value: 'LaneB' } })
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => expect(api.saveFlowDraft).toHaveBeenCalled())
    const saveInput = vi.mocked(api.saveFlowDraft).mock.calls[0][1]
    const savedDocument = JSON.parse(saveInput.draftDocumentJson)
    expect(savedDocument.routes).toEqual(expect.arrayContaining([
      { type: 0, source: 'DecideRoute', targets: ['LaneA', 'LaneB'], kind: 2, condition: 'BranchIndex' },
    ]))
  })
```

- [ ] **Step 2: Run test to verify it fails if switch support is incomplete**

Run:

```bash
npm test -- --run src/pages/FlowEditorPage.test.tsx
```

Expected before Task 3 implementation is complete: FAIL on missing switch controls. Expected after Task 3: PASS or a targeted failure that identifies missing ordered case handling.

- [ ] **Step 3: Add route editor styling**

Append these classes to `src/index.css` near `.binding-row`:

```css
.route-editor-section {
  border-top: 1px solid rgba(149, 161, 184, 0.1);
}

.panel-header.nested {
  padding: 0 0 12px;
  border-bottom: 0;
}

.route-editor-grid {
  display: grid;
  gap: 12px;
}

.route-editor-grid label,
.route-case-list label {
  display: grid;
  gap: 8px;
}

.route-editor-grid span,
.route-case-list span {
  color: #90a0bb;
  font-size: 0.8rem;
}

.route-case-list {
  display: grid;
  gap: 10px;
}

.route-case-list label {
  grid-template-columns: minmax(64px, 0.4fr) minmax(0, 1fr) auto;
  align-items: center;
}
```

- [ ] **Step 4: Run FlowEditorPage tests**

Run:

```bash
npm test -- --run src/pages/FlowEditorPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/FlowEditorPage.test.tsx src/index.css
git commit -m "feat: add switch route editor coverage"
```

---

### Task 5: Integration Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run targeted FlowView tests**

Run:

```bash
npm test -- --run src/lib/flowDraft.test.ts src/lib/routeEditor.test.ts src/pages/FlowEditorPage.test.tsx src/pages/FlowDefinitionsPage.test.tsx src/lib/api.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run FlowView build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Browser smoke test**

Start the dev server if no server is already listening on `127.0.0.1:5173`:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/flows/<existing-flow-code>/editor
```

Verify:

- The editor renders without console-visible crashes.
- Selecting a node shows `Outgoing routes`.
- Changing route mode to `Condition` updates visible graph edges with condition labels.
- Changing route mode to `Switch` can add a second case and labels remain readable.

- [ ] **Step 4: Final status check**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: no uncommitted source changes and recent route editor commits visible.

---

## Self-Review Notes

- Spec coverage: route metadata, Inspector editing, graph synchronization, direct canvas edge preservation, condition and switch authoring, tests, and out-of-scope expression editing are all covered by the tasks above.
- Placeholder scan: this plan contains no unfinished markers or unspecified implementation steps.
- Type consistency: `RouteKind`, `FlowEdgeData`, `OutgoingRouteState`, and helper names are introduced before use and reused consistently.
