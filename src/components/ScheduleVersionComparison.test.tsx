import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  SchedulePlanComparisonModel,
  SchedulePlanItemModel,
  SchedulePlanModel,
} from '../types'
import { ScheduleVersionComparison } from './ScheduleVersionComparison'

afterEach(cleanup)

function makeItem(overrides: Partial<SchedulePlanItemModel> = {}): SchedulePlanItemModel {
  return {
    id: 1,
    planId: 10,
    itemKind: 0,
    flowTaskId: 100,
    nodeId: 'Putaway',
    occurrence: 0,
    operationTaskId: 200,
    plannedStart: '2026-07-15T09:00:00.000Z',
    plannedEnd: '2026-07-15T10:00:00.000Z',
    actualStart: null,
    actualEnd: null,
    predictedEnd: null,
    expectedDuration: '01:00:00',
    status: 0,
    resourceType: null,
    resourceId: null,
    occupancyIndex: null,
    displayLabel: 'Put away pallet',
    displayContextJson: null,
    delayReason: null,
    isFrozen: false,
    ...overrides,
  }
}

function makePlan(overrides: Partial<SchedulePlanModel> = {}): SchedulePlanModel {
  return {
    id: 10,
    version: 2,
    previousPlanId: 9,
    status: 1,
    solverStatus: 2,
    trigger: 0,
    triggerDetail: 'Initial plan',
    horizonStart: '2026-07-15T08:00:00.000Z',
    horizonEnd: '2026-07-15T12:00:00.000Z',
    createdAt: '2026-07-15T07:50:00.000Z',
    committedAt: null,
    makespan: '04:00:00',
    items: [],
    latestSolveAttempt: null,
    ...overrides,
  }
}

function makeComparison(
  overrides: Partial<SchedulePlanComparisonModel> = {},
): SchedulePlanComparisonModel {
  return {
    planId: 10,
    previousPlanId: 9,
    changes: [],
    ...overrides,
  }
}

describe('ScheduleVersionComparison', () => {
  it('renders added, removed, and changed entries once with timestamps and reasons', () => {
    const previousStart = '2026-07-15T08:30:00.000Z'
    const currentStart = '2026-07-15T09:00:00.000Z'
    render(
      <ScheduleVersionComparison
        comparison={makeComparison({
          changes: [
            { kind: 0, currentItemId: 11, previousItemId: null, previousStart: null, currentStart, reason: 'ResourceChanged' },
            { kind: 1, currentItemId: null, previousItemId: 21, previousStart, currentStart: null, reason: null },
            { kind: 2, currentItemId: 12, previousItemId: 22, previousStart, currentStart, reason: 'PlannedStartChanged,OccupancyIndexChanged' },
          ],
        })}
        currentPlan={makePlan({
          items: [
            makeItem({ id: 11, displayLabel: 'Added node' }),
            makeItem({ id: 12, displayLabel: 'Changed node' }),
          ],
        })}
        previousPlan={makePlan({
          id: 9,
          version: 1,
          items: [
            makeItem({ id: 21, planId: 9, displayLabel: 'Removed node' }),
            makeItem({ id: 22, planId: 9, displayLabel: 'Previous changed node' }),
          ],
        })}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Schedule comparison v1 -> v2' })).toBeTruthy()
    const changes = screen.getAllByRole('listitem')
    expect(changes).toHaveLength(3)
    expect(within(changes[0]).getByText('Added')).toBeTruthy()
    expect(within(changes[1]).getByText('Removed')).toBeTruthy()
    expect(within(changes[2]).getByText('Changed')).toBeTruthy()
    expect(within(changes[0]).getByText('ResourceChanged')).toBeTruthy()
    expect(within(changes[1]).getByText('--', { selector: '.schedule-comparison-reason' })).toBeTruthy()
    expect(within(changes[2]).getByText('PlannedStartChanged,OccupancyIndexChanged')).toBeTruthy()
    expect(within(changes[2]).getByText(previousStart, { selector: 'time' }).getAttribute('datetime')).toBe(previousStart)
    expect(within(changes[2]).getByText(currentStart, { selector: 'time' }).getAttribute('datetime')).toBe(currentStart)
  })

  it('preserves server order without deriving additional changes', () => {
    render(
      <ScheduleVersionComparison
        comparison={makeComparison({
          changes: [
            { kind: 2, currentItemId: 3, previousItemId: 2, previousStart: null, currentStart: null, reason: 'Third from server' },
            { kind: 0, currentItemId: 1, previousItemId: null, previousStart: null, currentStart: null, reason: 'First from server' },
            { kind: 1, currentItemId: null, previousItemId: 4, previousStart: null, currentStart: null, reason: 'Second from server' },
          ],
        })}
        currentPlan={makePlan()}
        previousPlan={makePlan({ id: 9, version: 1 })}
      />,
    )

    expect(screen.getAllByRole('listitem').map((entry) => entry.textContent)).toEqual([
      expect.stringContaining('Third from server'),
      expect.stringContaining('First from server'),
      expect.stringContaining('Second from server'),
    ])
  })

  it('adds current and previous identity by exact referenced IDs', () => {
    render(
      <ScheduleVersionComparison
        comparison={makeComparison({
          changes: [{ kind: 2, currentItemId: 12, previousItemId: 22, previousStart: null, currentStart: null, reason: null }],
        })}
        currentPlan={makePlan({
          items: [makeItem({ id: 12, displayLabel: 'Current move', nodeId: 'Move', resourceType: 'Vehicle', resourceId: 'AGV-2' })],
        })}
        previousPlan={makePlan({
          id: 9,
          version: 1,
          items: [makeItem({ id: 22, displayLabel: 'Previous move', nodeId: 'Queue', resourceType: 'ConsoleInfo', resourceId: null })],
        })}
      />,
    )

    const entry = screen.getByRole('listitem')
    expect(entry.textContent).toContain('Current move; node Move; resource Vehicle / AGV-2')
    expect(entry.textContent).toContain('Previous move; node Queue; resource ConsoleInfo / --')
  })

  it('does not crash when referenced item IDs are missing', () => {
    render(
      <ScheduleVersionComparison
        comparison={makeComparison({
          changes: [{ kind: 2, currentItemId: 999, previousItemId: 998, previousStart: null, currentStart: null, reason: null }],
        })}
        currentPlan={makePlan()}
        previousPlan={makePlan({ id: 9, version: 1 })}
      />,
    )

    const entry = screen.getByRole('listitem')
    expect(within(entry).getByText('Current item', { selector: 'dt' }).nextElementSibling?.textContent).toBe('--')
    expect(within(entry).getByText('Previous item', { selector: 'dt' }).nextElementSibling?.textContent).toBe('--')
  })

  it('rejects stale current and previous plans for heading and item identity', () => {
    render(
      <ScheduleVersionComparison
        comparison={makeComparison({
          changes: [{ kind: 2, currentItemId: 12, previousItemId: 22, previousStart: null, currentStart: null, reason: null }],
        })}
        currentPlan={makePlan({
          id: 110,
          version: 98,
          items: [makeItem({ id: 12, planId: 110, displayLabel: 'Stale current item' })],
        })}
        previousPlan={makePlan({
          id: 109,
          version: 97,
          items: [makeItem({ id: 22, planId: 109, displayLabel: 'Stale previous item' })],
        })}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Schedule comparison plan 9 -> plan 10' })).toBeTruthy()
    expect(screen.queryByText(/v97|v98/)).toBeNull()
    expect(screen.queryByText(/Stale current item|Stale previous item/)).toBeNull()
    const entry = screen.getByRole('listitem')
    expect(within(entry).getByText('Current item', { selector: 'dt' }).nextElementSibling?.textContent).toBe('--')
    expect(within(entry).getByText('Previous item', { selector: 'dt' }).nextElementSibling?.textContent).toBe('--')
  })

  it('uses matching and stale plans independently', () => {
    render(
      <ScheduleVersionComparison
        comparison={makeComparison({
          changes: [{ kind: 2, currentItemId: 12, previousItemId: 22, previousStart: null, currentStart: null, reason: null }],
        })}
        currentPlan={makePlan({
          id: 10,
          version: 2,
          items: [makeItem({ id: 12, displayLabel: 'Matching current item' })],
        })}
        previousPlan={makePlan({
          id: 109,
          version: 97,
          items: [makeItem({ id: 22, planId: 109, displayLabel: 'Stale previous item' })],
        })}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Schedule comparison plan 9 -> plan 10' })).toBeTruthy()
    const entry = screen.getByRole('listitem')
    expect(within(entry).getByText('Current item', { selector: 'dt' }).nextElementSibling?.textContent)
      .toContain('Matching current item')
    expect(within(entry).getByText('Previous item', { selector: 'dt' }).nextElementSibling?.textContent).toBe('--')
    expect(screen.queryByText('Stale previous item')).toBeNull()
  })

  it('shows an unknown runtime kind fallback', () => {
    const comparison = makeComparison({
      changes: [{ kind: 99, currentItemId: null, previousItemId: null, previousStart: null, currentStart: null, reason: null }],
    } as unknown as Partial<SchedulePlanComparisonModel>)

    render(
      <ScheduleVersionComparison
        comparison={comparison}
        currentPlan={makePlan()}
        previousPlan={makePlan({ id: 9, version: 1 })}
      />,
    )

    expect(screen.getByText('Unknown (99)')).toBeTruthy()
  })

  it('renders no changes when server changes are empty even if plan arrays differ', () => {
    render(
      <ScheduleVersionComparison
        comparison={makeComparison()}
        currentPlan={makePlan({ items: [makeItem({ id: 10, displayLabel: 'Current only' })] })}
        previousPlan={makePlan({
          id: 9,
          version: 1,
          items: [makeItem({ id: 20, displayLabel: 'Previous only' })],
        })}
      />,
    )

    expect(screen.getByRole('status').textContent).toBe('No schedule changes')
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.queryByText('Current only')).toBeNull()
    expect(screen.queryByText('Previous only')).toBeNull()
  })

  it('shows failed solve metadata only for a failed latest attempt', () => {
    const failedPlan = makePlan({
      latestSolveAttempt: {
        id: 55,
        previousPlanId: 9,
        trigger: 2,
        triggerDetail: 'Manual replan',
        startedAt: '2026-07-15T11:10:00.000Z',
        finishedAt: '2026-07-15T11:10:05.000Z',
        status: 3,
        solverStatus: 4,
        failureReason: 'No feasible candidate',
        candidateCount: 7,
      },
    })
    const { rerender } = render(
      <ScheduleVersionComparison
        comparison={makeComparison()}
        currentPlan={failedPlan}
        previousPlan={makePlan({ id: 9, version: 1 })}
      />,
    )

    const summary = screen.getByRole('alert', { name: 'Failed solve attempt' })
    expect(summary.textContent).toContain('No feasible candidate')
    expect(summary.textContent).toContain('7')
    expect(Array.from(summary.querySelectorAll('time')).map((time) => time.dateTime)).toEqual([
      failedPlan.latestSolveAttempt?.startedAt,
      failedPlan.latestSolveAttempt?.finishedAt,
    ])

    rerender(
      <ScheduleVersionComparison
        comparison={makeComparison()}
        currentPlan={makePlan({ latestSolveAttempt: { ...failedPlan.latestSolveAttempt!, status: 2 } })}
        previousPlan={makePlan({ id: 9, version: 1 })}
      />,
    )
    expect(screen.queryByRole('alert', { name: 'Failed solve attempt' })).toBeNull()
  })

  it('keeps failed solve metadata visible while comparison data is loading', () => {
    const currentPlan = makePlan({
      latestSolveAttempt: {
        id: 55,
        previousPlanId: 9,
        trigger: 2,
        triggerDetail: 'Manual replan',
        startedAt: '2026-07-15T11:10:00.000Z',
        finishedAt: null,
        status: 3,
        solverStatus: 4,
        failureReason: 'No feasible candidate',
        candidateCount: 0,
      },
    })

    render(
      <ScheduleVersionComparison
        comparison={null}
        currentPlan={currentPlan}
        previousPlan={makePlan({ id: 9, version: 1 })}
        isLoading
      />,
    )

    expect(screen.getByRole('status').textContent).toBe('Loading schedule comparison')
    expect(screen.getByRole('alert', { name: 'Failed solve attempt' })).toBeTruthy()
  })

  it('renders distinct accessible loading, error, and null states', () => {
    const { rerender } = render(
      <ScheduleVersionComparison
        comparison={null}
        currentPlan={null}
        previousPlan={null}
        isLoading
      />,
    )

    expect(screen.getByRole('status').textContent).toBe('Loading schedule comparison')

    rerender(
      <ScheduleVersionComparison
        comparison={null}
        currentPlan={null}
        previousPlan={null}
        error={new Error('Comparison unavailable')}
      />,
    )
    expect(screen.getByRole('alert').textContent).toBe('Schedule comparison error: Comparison unavailable')

    rerender(
      <ScheduleVersionComparison
        comparison={null}
        currentPlan={null}
        previousPlan={null}
      />,
    )
    expect(screen.getByRole('status').textContent).toBe('No schedule comparison available')
  })
})
