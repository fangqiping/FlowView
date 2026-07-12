# FlowView Scheduling Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operational scheduling page with resource lanes, task identity, plan/actual comparison, rolling-plan history, and manual replan controls backed by the real FlowEngine API.

**Architecture:** A typed API feeds a polling hook that retains the last successful snapshot. Pure timeline functions derive lane geometry and open occupancy ranges. Focused components render summary, lanes, details, plan/actual overlays, and server-provided version differences; `SchedulingPage` owns selection and view mode.

**Tech Stack:** React 19, TypeScript 6, React Router, lucide-react, Vitest, Testing Library, Vite

**Repository:** `/Users/qiping/Desktop/codes/work/FlowView`

**Depends on:** `2026-07-13-backend-scheduling-integration-implementation-plan.md`

---

### Task 1: Add typed scheduling API contracts

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/lib/api.test.ts`

- [ ] **Step 1: Write failing endpoint tests**

Stub `fetch` and verify exact URLs/methods:

```ts
await api.getCurrentSchedulePlan()
await api.getSchedulePlan(18)
await api.getSchedulePlanHistory()
await api.compareSchedulePlans(18, 17)
await api.requestScheduleReplan()
```

Expected paths are `current`, `18`, `history`, `18/comparison?previousPlanId=17`, and POST `replan`. Assert replan sends no invented body.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/lib/api.test.ts
```

- [ ] **Step 3: Add server-matching DTOs**

Use numeric IDs and ISO strings:

```ts
export type ScheduleItemKind = 'nodeExecution' | 'resourceOccupancy'
export type ScheduleItemStatus =
  | 'planned' | 'waiting' | 'running' | 'completed'
  | 'delayed' | 'blocked' | 'canceled'

export interface SchedulePlanItemModel {
  id: number
  itemKind: ScheduleItemKind
  flowTaskId: number
  nodeId: string
  occurrence: number
  operationTaskId?: number | null
  resourceType?: string | null
  resourceId?: string | null
  plannedStart: string
  plannedEnd: string
  actualStart?: string | null
  actualEnd?: string | null
  predictedEnd?: string | null
  status: ScheduleItemStatus
  delayReason?: string | null
  isFrozen: boolean
  displayLabel: string
  displayContext?: Record<string, string | number | null>
}
```

Define plan, history, comparison, change, and solve-attempt interfaces exactly from the Server DTO. Include `latestSolveAttempt` on current plan.

- [ ] **Step 4: Add API methods, run GREEN, and commit**

```bash
npm test -- --run src/lib/api.test.ts
git add src/types.ts src/lib/api.ts src/lib/api.test.ts
git commit -m "Add scheduling API contracts"
```

### Task 2: Derive stable timeline geometry

**Files:**
- Create: `src/lib/scheduling.ts`
- Create: `src/lib/scheduling.test.ts`

- [ ] **Step 1: Write failing pure-function tests**

Cover grouping by `(resourceType, resourceId)`, stable sorting, horizon clamping, percentage geometry, invalid dates, and open occupancy ending at `min(now, horizonEnd)`.

```ts
expect(groupResourceOccupancies(items).map((lane) => lane.key)).toEqual([
  'ConsoleInfo/Conveyor',
  'ConsoleInfo/StackCrane',
])

expect(resolveActualInterval(openItem, now, horizonEnd)).toEqual({
  start: openItem.actualStart,
  end: now,
})
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/lib/scheduling.test.ts
```

- [ ] **Step 3: Implement pure helpers**

Export `groupResourceOccupancies`, `getTimelineGeometry`, `resolveActualInterval`, `formatScheduleDeviation`, and `isDelayedItem`. Invalid dates return zero-width geometry rather than `NaN`.

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test -- --run src/lib/scheduling.test.ts
git add src/lib/scheduling.ts src/lib/scheduling.test.ts
git commit -m "Add scheduling timeline model"
```

### Task 3: Poll plans and coordinate replan state

**Files:**
- Create: `src/lib/useSchedulingWorkbench.ts`
- Create: `src/lib/useSchedulingWorkbench.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Render a harness with `pollIntervalMs: 20`. Cover initial load, periodic refresh, retaining last data after refresh failure, duplicate POST prevention, immediate refresh after POST, and clearing busy state when current's latest attempt matches the submitted attempt in a terminal state.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/lib/useSchedulingWorkbench.test.tsx
```

- [ ] **Step 3: Implement the hook**

```ts
export interface SchedulingWorkbenchState {
  plan: SchedulePlanModel | null
  history: SchedulePlanHistoryModel[]
  error: Error | null
  lastUpdatedAt: Date | null
  isLoading: boolean
  isReplanning: boolean
  refresh(): Promise<void>
  replan(): Promise<void>
}
```

Load current and history concurrently. Retain previous plan on refresh error. Use one interval, clear it on unmount, and guard concurrent refresh/replan with refs. Do not derive version differences in the hook.

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test -- --run src/lib/useSchedulingWorkbench.test.tsx
git add src/lib/useSchedulingWorkbench.ts src/lib/useSchedulingWorkbench.test.tsx
git commit -m "Add scheduling workbench state"
```

### Task 4: Render resource lanes and task identity

**Files:**
- Create: `src/components/ResourceScheduleLanes.tsx`
- Create: `src/components/ResourceScheduleLanes.test.tsx`
- Create: `src/components/ScheduleItemDetails.tsx`
- Create: `src/components/ScheduleItemDetails.test.tsx`

- [ ] **Step 1: Write failing component tests**

Render two resources and assert each occupancy appears in the correct lane. Click `IN-2407 / P-018 · 上架` and assert the exact item reaches `onSelect`. In details, assert FlowTask, OperationTask, order, pallet, node, resource, planned/actual times, deviation, and delay reason.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run \
  src/components/ResourceScheduleLanes.test.tsx \
  src/components/ScheduleItemDetails.test.tsx
```

- [ ] **Step 3: Implement accessible lanes and inspector**

Use buttons for occupancy blocks and `aria-pressed` for selection. Keep a stable lane-label column. The block label is `displayLabel`. Open actual occupancy extends to supplied `now`, but must not imply percentage progress because devices provide only start/complete events.

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test -- --run \
  src/components/ResourceScheduleLanes.test.tsx \
  src/components/ScheduleItemDetails.test.tsx
git add src/components/ResourceScheduleLanes* src/components/ScheduleItemDetails*
git commit -m "Add scheduling resource lanes"
```

### Task 5: Render plan/actual and version comparison

**Files:**
- Create: `src/components/PlanActualTimeline.tsx`
- Create: `src/components/PlanActualTimeline.test.tsx`
- Create: `src/components/FlowScheduleTimeline.tsx`
- Create: `src/components/FlowScheduleTimeline.test.tsx`
- Create: `src/components/ScheduleVersionComparison.tsx`
- Create: `src/components/ScheduleVersionComparison.test.tsx`

- [ ] **Step 1: Write failing visual behavior tests**

Assert planned intervals use an outline class, actual intervals use on-time/delayed classes, unstarted work has no actual bar, and open occupancy ends at `now`. Assert the flow timeline groups `NodeExecution` items by FlowTask and orders occurrences by planned start. For comparison, assert moved before/after timestamps, added/removed/status/frozen change kinds, and failed-solve summary.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run \
  src/components/PlanActualTimeline.test.tsx \
  src/components/FlowScheduleTimeline.test.tsx \
  src/components/ScheduleVersionComparison.test.tsx
```

- [ ] **Step 3: Implement both components**

Render `SchedulePlanComparisonModel.changes` exactly as returned by the API. Do not compare plan arrays in React. `FlowScheduleTimeline` uses node execution items rather than resource occupancy items. Status colors must have visible text, not color-only meaning.

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test -- --run \
  src/components/PlanActualTimeline.test.tsx \
  src/components/FlowScheduleTimeline.test.tsx \
  src/components/ScheduleVersionComparison.test.tsx
git add src/components/PlanActualTimeline* src/components/FlowScheduleTimeline* src/components/ScheduleVersionComparison*
git commit -m "Add schedule comparison views"
```

### Task 6: Compose SchedulingPage

**Files:**
- Create: `src/components/SchedulingSummary.tsx`
- Create: `src/pages/SchedulingPage.tsx`
- Create: `src/pages/SchedulingPage.test.tsx`

- [ ] **Step 1: Write failing page tests**

Mock the hook. Cover loading, no plan, current summary, last successful data plus refresh error, segmented views, selected occupancy details, history selection, comparison loading, and replan disabled/busy/error states.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/pages/SchedulingPage.test.tsx
```

- [ ] **Step 3: Implement the work-focused page**

Default to resource lanes. Use compact summary metrics, segmented controls for resources/flow/actual/versions, horizontal timeline, and right inspector on desktop. Move inspector below timeline on narrow screens. Use lucide `RefreshCw` and `LoaderCircle`.

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test -- --run src/pages/SchedulingPage.test.tsx
git add src/components/SchedulingSummary.tsx src/pages/SchedulingPage*
git commit -m "Compose scheduling workbench page"
```

### Task 7: Add navigation, translations, and responsive CSS

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AppShell.test.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/i18n/messages.en-US.ts`
- Modify: `src/i18n/messages.zh-Hans-CN.ts`
- Modify: `src/index.css`
- Modify: `src/pages/SchedulingPage.test.tsx`

- [ ] **Step 1: Write failing route/navigation tests**

Render `App` at `/scheduling`, assert scheduling heading, and assert AppShell has a translated scheduling link.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/components/AppShell.test.tsx src/pages/SchedulingPage.test.tsx
```

- [ ] **Step 3: Add route and navigation**

```tsx
<Route path="/scheduling" element={<SchedulingPage />} />
```

Use lucide `CalendarClock`. Add `nav.scheduling` and all `scheduling.*` keys to the MessageKey union and both dictionaries.

- [ ] **Step 4: Add scheduling CSS**

Follow existing dark palette and 8px radius. Use stable label columns and minimum timeline widths. At existing 1024px/640px breakpoints, move inspector below and preserve horizontal scrolling. Do not add gradients, decorative cards, or nested cards.

- [ ] **Step 5: Run GREEN and commit**

```bash
npm test -- --run src/components/AppShell.test.tsx src/pages/SchedulingPage.test.tsx
git add src/App.tsx src/components/AppShell* src/i18n src/index.css src/pages/SchedulingPage.test.tsx
git commit -m "Wire scheduling workbench navigation"
```

### Task 8: Verify the end-to-end workbench

**Files:**
- Modify only when verification exposes a scheduling-specific defect

- [ ] **Step 1: Run FlowView verification**

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Start Backend and FlowView**

```bash
cd /Users/qiping/Desktop/codes/work/Backend
dotnet run --project src/Backend.Demo --urls http://127.0.0.1:5086
```

```bash
cd /Users/qiping/Desktop/codes/work/FlowView
npm run dev -- --host 127.0.0.1
```

- [ ] **Step 3: Verify in the browser**

Open `http://127.0.0.1:5173/scheduling`. Verify desktop and 390px widths, five-second refresh, occupancy details, operation-complete/resource-still-held display, plan/actual overlay, adjacent version comparison, manual replan busy state, and retaining last data during API error.

- [ ] **Step 4: Commit verification fixes when needed**

If Step 3 required changes, rerun Step 1 before committing:

```bash
git add src
git commit -m "Verify scheduling workbench workflow"
```
