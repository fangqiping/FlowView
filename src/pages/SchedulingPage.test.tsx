import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { I18nProvider } from '../i18n/I18nProvider'
import { NotificationCenterProvider } from '../notifications/NotificationCenterProvider'
import type {
  SchedulePlanComparisonModel,
  SchedulePlanItemModel,
  SchedulePlanModel,
} from '../types'
import {
  useSchedulingWorkbench,
  type SchedulingWorkbenchState,
} from '../lib/useSchedulingWorkbench'
import { SchedulingPage } from './SchedulingPage'

vi.mock('../lib/useSchedulingWorkbench', () => ({
  useSchedulingWorkbench: vi.fn(),
}))

function createItem(
  overrides: Partial<SchedulePlanItemModel> = {},
): SchedulePlanItemModel {
  return {
    id: 101,
    planId: 3,
    itemKind: 0,
    flowTaskId: 42,
    nodeId: 'Pick',
    occurrence: 1,
    operationTaskId: 501,
    plannedStart: '2026-07-15T10:00:00Z',
    plannedEnd: '2026-07-15T10:20:00Z',
    actualStart: null,
    actualEnd: null,
    predictedEnd: null,
    expectedDuration: 'PT20M',
    status: 1,
    resourceType: null,
    resourceId: null,
    occupancyIndex: null,
    displayLabel: 'Pick order',
    displayContextJson: '{"orderCode":"ORD-42"}',
    delayReason: null,
    isFrozen: false,
    ...overrides,
  }
}

function createPlan(overrides: Partial<SchedulePlanModel> = {}): SchedulePlanModel {
  return {
    id: 3,
    version: 3,
    previousPlanId: 2,
    status: 1,
    solverStatus: 4,
    trigger: 1,
    triggerDetail: 'Manual schedule',
    horizonStart: '2026-07-15T10:00:00Z',
    horizonEnd: '2026-07-15T12:00:00Z',
    createdAt: '2026-07-15T09:59:00Z',
    committedAt: '2026-07-15T09:59:30Z',
    makespan: 'PT2H',
    latestSolveAttempt: null,
    items: [
      createItem(),
      createItem({
        id: 102,
        nodeId: 'Move',
        displayLabel: 'Move pallet',
        status: 2,
      }),
      createItem({
        id: 103,
        nodeId: 'Pack',
        displayLabel: 'Pack order',
        status: 4,
      }),
      createItem({
        id: 201,
        itemKind: 1,
        operationTaskId: 601,
        resourceType: 'Forklift',
        resourceId: 'F-1',
        occupancyIndex: 0,
        displayLabel: 'Forklift occupancy',
        actualStart: '2026-07-15T10:05:00Z',
        status: 2,
      }),
      createItem({
        id: 202,
        itemKind: 1,
        operationTaskId: 602,
        resourceType: 'Conveyor',
        resourceId: 'C-1',
        occupancyIndex: 0,
        displayLabel: 'Conveyor occupancy',
        plannedStart: '2026-07-15T10:30:00Z',
        plannedEnd: '2026-07-15T11:00:00Z',
        predictedEnd: '2026-07-15T11:30:00Z',
        actualStart: '2026-07-15T10:35:00Z',
        actualEnd: '2026-07-15T11:05:00Z',
        status: 3,
      }),
    ],
    ...overrides,
  }
}

function createState(
  overrides: Partial<SchedulingWorkbenchState> = {},
): SchedulingWorkbenchState {
  return {
    plan: createPlan(),
    history: [],
    error: null,
    lastUpdatedAt: new Date('2026-07-15T12:34:56.000Z'),
    isLoading: false,
    isReplanning: false,
    refresh: vi.fn(async () => {}),
    replan: vi.fn(async () => {}),
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, reject, resolve }
}

function renderPage(
  state: SchedulingWorkbenchState,
  compareSchedulePlans = vi.fn<
    (planId: number, previousPlanId: number) => Promise<SchedulePlanComparisonModel>
  >(),
  language: 'en-US' | 'zh-Hans-CN' = 'en-US',
) {
  vi.mocked(useSchedulingWorkbench).mockReturnValue(state)
  return {
    compareSchedulePlans,
    ...renderWithI18n(<SchedulingPage apiOverride={{ compareSchedulePlans }} />, language),
  }
}

function renderWithI18n(
  ui: ReactElement,
  language: 'en-US' | 'zh-Hans-CN' = 'en-US',
) {
  localStorage.setItem('flowview.language', language)
  return render(ui, { wrapper: I18nProvider })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

describe('SchedulingPage states and summary', () => {
  it('renders the scheduling route', () => {
    localStorage.setItem('flowview.language', 'en-US')
    vi.mocked(useSchedulingWorkbench).mockReturnValue(createState())

    render(
      <I18nProvider>
        <NotificationCenterProvider autoConnect={false}>
          <MemoryRouter initialEntries={['/scheduling']}>
            <App />
          </MemoryRouter>
        </NotificationCenterProvider>
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Global scheduling' })).toBeTruthy()
  })

  it('renders an accessible initial loading state', () => {
    renderPage(createState({ plan: null, isLoading: true, lastUpdatedAt: null }))

    expect(screen.getByRole('status').textContent).toContain('Loading schedule workbench')
    expect((screen.getByRole('button', { name: 'Refresh schedule' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders an accessible no-plan state and retains the replan action', () => {
    renderPage(createState({ plan: null, lastUpdatedAt: null }))

    expect(screen.getByRole('status').textContent).toContain('No current schedule plan')
    expect((screen.getByRole('button', { name: 'Replan now' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('renders an error banner together with the no-plan state', () => {
    renderPage(createState({
      plan: null,
      error: new Error('Schedule service unavailable'),
      lastUpdatedAt: null,
    }))

    expect(screen.getByRole('alert').textContent)
      .toBe('Failed to update the scheduling workbench.')
    expect(screen.getByRole('status').textContent).toContain('No current schedule plan')
  })

  it('localizes the scheduling page and its error states in Chinese', () => {
    const compareSchedulePlans = vi.fn<
      (planId: number, previousPlanId: number) => Promise<SchedulePlanComparisonModel>
    >()
    const { rerender } = renderPage(
      createState({ error: new Error() }),
      compareSchedulePlans,
      'zh-Hans-CN',
    )

    expect(screen.getByRole('heading', { name: '全局调度' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '资源' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '流程' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '计划与实际' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '版本' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '调度摘要' }))
      .getByText('已提交')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('调度工作台更新失败。')

    vi.mocked(useSchedulingWorkbench).mockReturnValue(createState({
      plan: null,
      error: new Error('503 upstream timeout'),
      lastUpdatedAt: null,
    }))
    rerender(<SchedulingPage apiOverride={{ compareSchedulePlans }} />)

    expect(screen.getByRole('alert').textContent)
      .toBe('调度工作台更新失败。')
    expect(screen.queryByText(/503 upstream timeout/)).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('暂无当前调度计划')
  })

  it('summarizes the current plan and retains it through a later refresh error', () => {
    const plan = createPlan()
    renderPage(createState({
      plan,
      error: new Error('Refresh failed'),
      isLoading: true,
    }))

    expect(screen.getByRole('heading', { name: 'Global scheduling' })).toBeTruthy()
    expect(screen.getByText('Operations')).toBeTruthy()
    expect(screen.getByRole('alert').textContent)
      .toBe('Failed to update the scheduling workbench.')

    const summary = screen.getByRole('region', { name: 'Scheduling summary' })
    expect(within(summary).getByText('v3')).toBeTruthy()
    expect(within(summary).getByText('Committed')).toBeTruthy()
    expect(within(summary).getByText('Optimal')).toBeTruthy()
    expect(within(summary).getByText('Waiting').parentElement?.textContent).toBe('Waiting1')
    expect(within(summary).getByText('Resource occupancies').parentElement?.textContent)
      .toBe('Resource occupancies2')
    expect(within(summary).getByText('2026-07-15T11:30:00Z').getAttribute('datetime'))
      .toBe('2026-07-15T11:30:00Z')
    expect(within(summary).getByText('2026-07-15T12:34:56.000Z').getAttribute('datetime'))
      .toBe('2026-07-15T12:34:56.000Z')
    expect(within(summary).getByRole('status').textContent).toContain('Refreshing')
  })

  it('uses unknown fallbacks for unrecognized plan and solver statuses', () => {
    const plan = createPlan({
      status: 9 as SchedulePlanModel['status'],
      solverStatus: 8 as SchedulePlanModel['solverStatus'],
    })
    renderPage(createState({ plan }))

    const summary = screen.getByRole('region', { name: 'Scheduling summary' })
    expect(within(summary).getByText('Unknown (9)')).toBeTruthy()
    expect(within(summary).getByText('Unknown (8)')).toBeTruthy()
  })
})

describe('SchedulingPage controls and views', () => {
  it('defaults to resources and selects the exact occupancy clicked', () => {
    renderPage(createState())

    expect(screen.getByRole('button', { name: 'Resources' }).getAttribute('aria-pressed'))
      .toBe('true')
    expect(within(screen.getByRole('region', { name: 'Schedule item details' }))
      .getByText('Conveyor / C-1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', {
      name: /Forklift occupancy; FlowTask 42; node Pick; resource Forklift \/ F-1/,
    }))

    const details = screen.getByRole('region', { name: 'Schedule item details' })
    expect(within(details).getByText('601')).toBeTruthy()
    expect(within(details).getByText('Forklift / F-1')).toBeTruthy()
  })

  it('renders the selected flow and plan-versus-actual views while retaining summary', () => {
    renderPage(createState())

    fireEvent.click(screen.getByRole('button', { name: 'Flow' }))
    expect(screen.getByText('Pick order', { selector: 'strong' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Schedule item details' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Plan vs actual' }))
    expect(screen.getByText('Forklift occupancy', { selector: 'strong' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Scheduling summary' })).toBeTruthy()
  })

  it('calls refresh and replan commands and exposes busy controls and errors', () => {
    const state = createState()
    const { rerender } = renderPage(state)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh schedule' }))
    fireEvent.click(screen.getByRole('button', { name: 'Replan now' }))
    expect(state.refresh).toHaveBeenCalledTimes(1)
    expect(state.replan).toHaveBeenCalledTimes(1)

    vi.mocked(useSchedulingWorkbench).mockReturnValue(createState({
      error: new Error('Replan request failed'),
      isLoading: true,
      isReplanning: true,
    }))
    rerender(<SchedulingPage apiOverride={{ compareSchedulePlans: vi.fn() }} />)

    expect((screen.getByRole('button', { name: 'Refresh schedule' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Replan now' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Replan now' }).getAttribute('aria-busy'))
      .toBe('true')
    expect(screen.getByRole('alert').textContent)
      .toBe('Failed to update the scheduling workbench.')
  })

  it('falls back when the explicitly selected occupancy disappears on refresh', () => {
    const initialPlan = createPlan()
    const { rerender } = renderPage(createState({ plan: initialPlan }))
    fireEvent.click(screen.getByRole('button', {
      name: /Forklift occupancy; FlowTask 42; node Pick; resource Forklift \/ F-1/,
    }))
    expect(within(screen.getByRole('region', { name: 'Schedule item details' }))
      .getByText('Forklift / F-1')).toBeTruthy()

    const refreshedPlan = createPlan({
      items: initialPlan.items.filter((item) => item.id !== 201),
    })
    vi.mocked(useSchedulingWorkbench).mockReturnValue(createState({ plan: refreshedPlan }))
    rerender(<SchedulingPage apiOverride={{ compareSchedulePlans: vi.fn() }} />)

    const details = screen.getByRole('region', { name: 'Schedule item details' })
    expect(within(details).queryByText('Forklift / F-1')).toBeNull()
    expect(within(details).getByText('Conveyor / C-1')).toBeTruthy()
  })
})

describe('SchedulingPage versions', () => {
  function versionHistory() {
    const current = createPlan()
    const previous = createPlan({ id: 2, version: 2, previousPlanId: 1 })
    const oldest = createPlan({ id: 1, version: 1, previousPlanId: null })
    return { current, history: [current, previous, oldest], oldest, previous }
  }

  it('preserves history order, defaults to current, and changes the selected version', async () => {
    const { current, history } = versionHistory()
    const compare = vi.fn().mockResolvedValue({
      planId: 3,
      previousPlanId: 2,
      changes: [],
    })
    renderPage(createState({ history, plan: current }), compare)

    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))

    const select = screen.getByRole('combobox', { name: 'Schedule version' })
    expect((select as HTMLSelectElement).value).toBe('3')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'v3',
      'v2',
      'v1',
    ])
    await waitFor(() => expect(compare).toHaveBeenCalledWith(3, 2))

    fireEvent.change(select, { target: { value: '2' } })
    await waitFor(() => expect(compare).toHaveBeenCalledWith(2, 1))
  })

  it('uses the first history plan when the current plan is absent from history', async () => {
    const { previous, oldest } = versionHistory()
    const compare = vi.fn().mockResolvedValue({
      planId: 2,
      previousPlanId: 1,
      changes: [],
    })
    renderPage(createState({ history: [previous, oldest] }), compare)

    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))

    expect((screen.getByRole('combobox', { name: 'Schedule version' }) as HTMLSelectElement).value)
      .toBe('2')
    await waitFor(() => expect(compare).toHaveBeenCalledWith(2, 1))
  })

  it('shows comparison loading and then passes server results to the comparison view', async () => {
    const { current, history } = versionHistory()
    const request = deferred<SchedulePlanComparisonModel>()
    const compare = vi.fn().mockReturnValue(request.promise)
    renderPage(createState({ history, plan: current }), compare)

    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))
    expect(screen.getByRole('status').textContent).toContain('Loading schedule comparison')

    await act(async () => {
      request.resolve({
        planId: 3,
        previousPlanId: 2,
        changes: [{
          kind: 2,
          currentItemId: 201,
          previousItemId: 201,
          previousStart: '2026-07-15T09:55:00Z',
          currentStart: '2026-07-15T10:00:00Z',
          reason: 'Resource conflict resolved',
        }],
      })
      await request.promise
    })

    expect(await screen.findByRole('heading', {
      name: 'Schedule comparison v2 -> v3',
    })).toBeTruthy()
    expect(screen.getByText('Resource conflict resolved')).toBeTruthy()
  })

  it('ignores a stale comparison response after selecting another version', async () => {
    const { current, history } = versionHistory()
    const currentRequest = deferred<SchedulePlanComparisonModel>()
    const previousRequest = deferred<SchedulePlanComparisonModel>()
    const compare = vi.fn()
      .mockReturnValueOnce(currentRequest.promise)
      .mockReturnValueOnce(previousRequest.promise)
    renderPage(createState({ history, plan: current }), compare)

    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Schedule version' }), {
      target: { value: '2' },
    })

    await act(async () => {
      previousRequest.resolve({
        planId: 2,
        previousPlanId: 1,
        changes: [{
          kind: 2,
          currentItemId: 201,
          previousItemId: 201,
          previousStart: null,
          currentStart: null,
          reason: 'Newest selection result',
        }],
      })
      await previousRequest.promise
    })
    expect(await screen.findByText('Newest selection result')).toBeTruthy()

    await act(async () => {
      currentRequest.resolve({
        planId: 3,
        previousPlanId: 2,
        changes: [{
          kind: 2,
          currentItemId: 201,
          previousItemId: 201,
          previousStart: null,
          currentStart: null,
          reason: 'Stale result',
        }],
      })
      await currentRequest.promise
    })
    expect(screen.queryByText('Stale result')).toBeNull()
    expect(screen.getByText('Newest selection result')).toBeTruthy()
  })

  it('treats an error from the previous API client as loading until the new client succeeds', async () => {
    const { current, history } = versionHistory()
    const nextRequest = deferred<SchedulePlanComparisonModel>()
    const apiA = {
      compareSchedulePlans: vi.fn().mockRejectedValue(new Error('API A error')),
    }
    const apiB = {
      compareSchedulePlans: vi.fn().mockReturnValue(nextRequest.promise),
    }
    vi.mocked(useSchedulingWorkbench).mockReturnValue(createState({ history, plan: current }))
    const { rerender } = renderWithI18n(<SchedulingPage apiOverride={apiA} />)
    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))
    expect((await screen.findByRole('alert')).textContent)
      .toBe('Failed to load the schedule comparison.')
    expect(screen.queryByText(/API A error/)).toBeNull()

    rerender(<SchedulingPage apiOverride={apiB} />)

    expect(screen.queryByText(/API A error/)).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Loading schedule comparison')

    await act(async () => {
      nextRequest.resolve({
        planId: 3,
        previousPlanId: 2,
        changes: [{
          kind: 2,
          currentItemId: 201,
          previousItemId: 201,
          previousStart: null,
          currentStart: null,
          reason: 'API B result',
        }],
      })
      await nextRequest.promise
    })

    expect(await screen.findByText('API B result')).toBeTruthy()
    expect(screen.queryByText(/API A error/)).toBeNull()
  })

  it('ignores a late result from the previous API client for the same plan IDs', async () => {
    const { current, history } = versionHistory()
    const oldRequest = deferred<SchedulePlanComparisonModel>()
    const nextRequest = deferred<SchedulePlanComparisonModel>()
    const apiA = {
      compareSchedulePlans: vi.fn().mockReturnValue(oldRequest.promise),
    }
    const apiB = {
      compareSchedulePlans: vi.fn().mockReturnValue(nextRequest.promise),
    }
    vi.mocked(useSchedulingWorkbench).mockReturnValue(createState({ history, plan: current }))
    const { rerender } = renderWithI18n(<SchedulingPage apiOverride={apiA} />)
    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))
    await waitFor(() => expect(apiA.compareSchedulePlans).toHaveBeenCalledWith(3, 2))

    rerender(<SchedulingPage apiOverride={apiB} />)
    expect(screen.getByRole('status').textContent).toContain('Loading schedule comparison')
    await waitFor(() => expect(apiB.compareSchedulePlans).toHaveBeenCalledWith(3, 2))

    await act(async () => {
      nextRequest.resolve({
        planId: 3,
        previousPlanId: 2,
        changes: [{
          kind: 2,
          currentItemId: 201,
          previousItemId: 201,
          previousStart: null,
          currentStart: null,
          reason: 'Current API result',
        }],
      })
      await nextRequest.promise
    })
    expect(await screen.findByText('Current API result')).toBeTruthy()

    await act(async () => {
      oldRequest.resolve({
        planId: 3,
        previousPlanId: 2,
        changes: [{
          kind: 2,
          currentItemId: 201,
          previousItemId: 201,
          previousStart: null,
          currentStart: null,
          reason: 'Late API A result',
        }],
      })
      await oldRequest.promise
    })

    expect(screen.queryByText('Late API A result')).toBeNull()
    expect(screen.getByText('Current API result')).toBeTruthy()
  })

  it('renders a distinct comparison error state', async () => {
    const { current, history } = versionHistory()
    const compare = vi.fn().mockRejectedValue(new Error('Comparison unavailable'))
    renderPage(createState({ history, plan: current }), compare)

    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))

    expect((await screen.findByRole('alert')).textContent)
      .toBe('Failed to load the schedule comparison.')
  })

  it('does not call the API when the selected plan has no previous plan ID', () => {
    const plan = createPlan({ id: 1, version: 1, previousPlanId: null })
    const compare = vi.fn()
    renderPage(createState({ history: [plan], plan }), compare)

    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))

    expect(compare).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toContain('No schedule comparison available')
  })

  it('does not infer changes when the server comparison is empty', async () => {
    const current = createPlan({
      items: [createItem({ id: 900, displayLabel: 'Only in current' })],
    })
    const previous = createPlan({
      id: 2,
      version: 2,
      previousPlanId: 1,
      items: [createItem({ id: 800, displayLabel: 'Only in previous' })],
    })
    const compare = vi.fn().mockResolvedValue({
      planId: 3,
      previousPlanId: 2,
      changes: [],
    })
    renderPage(createState({ history: [current, previous], plan: current }), compare)

    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))

    expect(await screen.findByText('No schedule changes')).toBeTruthy()
    expect(screen.queryByText('Added')).toBeNull()
    expect(screen.queryByText('Removed')).toBeNull()
  })
})
