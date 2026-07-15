import { cleanup, render as rtlRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import type { SchedulePlanItemModel } from '../types'
import { PlanActualTimeline } from './PlanActualTimeline'

const HORIZON_START = '2026-07-15T08:00:00.000Z'
const HORIZON_END = '2026-07-15T12:00:00.000Z'
const NOW = '2026-07-15T11:00:00.000Z'

afterEach(cleanup)

function render(ui: ReactElement) {
  localStorage.setItem('flowview.language', 'en-US')
  return rtlRender(ui, { wrapper: I18nProvider })
}

function makeItem(overrides: Partial<SchedulePlanItemModel> = {}): SchedulePlanItemModel {
  return {
    id: 1,
    planId: 10,
    itemKind: 1,
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
    resourceType: 'ConsoleInfo',
    resourceId: 'StackCrane',
    occupancyIndex: 0,
    displayLabel: 'Move pallet',
    displayContextJson: null,
    delayReason: null,
    isFrozen: false,
    ...overrides,
  }
}

function renderTimeline(items: SchedulePlanItemModel[]) {
  return render(
    <PlanActualTimeline
      items={items}
      horizonStart={HORIZON_START}
      horizonEnd={HORIZON_END}
      now={NOW}
    />,
  )
}

describe('PlanActualTimeline', () => {
  it('overlays outlined planned and solid actual intervals with visible timing status', () => {
    renderTimeline([
      makeItem({
        id: 1,
        displayLabel: 'On-time move',
        actualStart: '2026-07-15T09:15:00.000Z',
        actualEnd: '2026-07-15T09:45:00.000Z',
        status: 3,
      }),
      makeItem({
        id: 2,
        displayLabel: 'Delayed move',
        actualStart: '2026-07-15T09:30:00.000Z',
        actualEnd: '2026-07-15T10:30:00.000Z',
        status: 3,
      }),
    ])

    const onTimeRow = screen.getByRole('listitem', { name: /On-time move/ })
    const delayedRow = screen.getByRole('listitem', { name: /Delayed move/ })
    const onTimeActual = onTimeRow.querySelector('.plan-actual-actual')
    const delayedActual = delayedRow.querySelector('.plan-actual-actual')

    expect(onTimeRow.querySelector('.plan-actual-planned')).not.toBeNull()
    expect(onTimeActual?.classList.contains('on-time')).toBe(true)
    expect(within(onTimeRow).getByText('On time')).toBeTruthy()
    expect(delayedActual?.classList.contains('delayed')).toBe(true)
    expect(within(delayedRow).getByText('Delayed')).toBeTruthy()
  })

  it('renders unstarted work with planned geometry only and visible state', () => {
    renderTimeline([makeItem({ displayLabel: 'Waiting move' })])

    const row = screen.getByRole('listitem', { name: /Waiting move/ })
    expect(row.querySelector('.plan-actual-planned')).not.toBeNull()
    expect(row.querySelector('.plan-actual-actual')).toBeNull()
    expect(within(row).getByText('Not started')).toBeTruthy()
  })

  it.each([
    [4, 'Delayed', 'delayed'],
    [5, 'Blocked', 'blocked'],
    [6, 'Canceled', 'canceled'],
    [99, 'Unknown (99)', 'unknown'],
  ])('preserves lifecycle status %s independently from timing state', (status, label, statusClass) => {
    const item = {
      ...makeItem({ displayLabel: `${label} move` }),
      status,
    } as SchedulePlanItemModel

    renderTimeline([item])

    const row = screen.getByRole('listitem', {
      name: (accessibleName) => accessibleName.includes(`${label} move`),
    })
    const lifecycle = within(row).getByText(label)
    expect(lifecycle.classList.contains('plan-actual-lifecycle')).toBe(true)
    expect(lifecycle.classList.contains(statusClass)).toBe(true)
    expect(row.classList.contains(`lifecycle-${statusClass}`)).toBe(true)
    expect(within(row).getByText('Not started')).toBeTruthy()
  })

  it('ends an open actual interval at now and exposes its open state', () => {
    renderTimeline([makeItem({
      displayLabel: 'Open move',
      plannedStart: '2026-07-15T08:30:00.000Z',
      actualStart: '2026-07-15T09:00:00.000Z',
      status: 2,
    })])

    const row = screen.getByRole('listitem', { name: /Open move/ })
    const actual = row.querySelector('.plan-actual-actual')
    expect(actual?.getAttribute('style')).toContain('left: 25%')
    expect(actual?.getAttribute('style')).toContain('width: 50%')
    expect(actual?.classList.contains('open')).toBe(true)
    expect(within(row).getByText(/Open/, { selector: 'span' })).toBeTruthy()
    expect(within(row).getByText(NOW, { selector: 'time' }).getAttribute('datetime')).toBe(NOW)
  })

  it('groups resource occupancies and filters every other item kind', () => {
    renderTimeline([
      makeItem({ id: 1, displayLabel: 'Crane move' }),
      makeItem({ id: 2, resourceType: 'Vehicle', resourceId: 'AGV-1', displayLabel: 'Vehicle move' }),
      makeItem({ id: 3, itemKind: 0, displayLabel: 'Node execution' }),
      makeItem({ id: 4, itemKind: 2, displayLabel: 'Flow summary' }),
    ])

    expect(screen.getByRole('group', { name: 'ConsoleInfo / StackCrane' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Vehicle / AGV-1' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText('Node execution')).toBeNull()
    expect(screen.queryByText('Flow summary')).toBeNull()
  })

  it('keeps row text but omits invalid, zero-width, and outside bars', () => {
    renderTimeline([
      makeItem({
        id: 1,
        displayLabel: 'Invalid interval',
        plannedStart: 'invalid',
        actualStart: 'invalid',
      }),
      makeItem({
        id: 2,
        displayLabel: 'Zero interval',
        plannedEnd: '2026-07-15T09:00:00.000Z',
      }),
      makeItem({
        id: 3,
        displayLabel: 'Outside interval',
        plannedStart: '2026-07-15T13:00:00.000Z',
        plannedEnd: '2026-07-15T14:00:00.000Z',
      }),
    ])

    for (const label of ['Invalid interval', 'Zero interval', 'Outside interval']) {
      const row = screen.getByRole('listitem', { name: new RegExp(label) })
      expect(row.querySelector('.plan-actual-planned')).toBeNull()
      expect(row.querySelector('.plan-actual-actual')).toBeNull()
      expect(row.querySelector('[tabindex]')).toBeNull()
    }
  })

  it('shows item, resource, planned timestamps, and actual timestamps', () => {
    const item = makeItem({
      displayLabel: 'Inspectable move',
      resourceType: 'Vehicle',
      resourceId: 'AGV-7',
      actualStart: '2026-07-15T09:10:00.000Z',
      actualEnd: '2026-07-15T09:50:00.000Z',
    })
    renderTimeline([item])

    const row = screen.getByRole('listitem', { name: /Inspectable move/ })
    expect(row.textContent).toContain('Vehicle / AGV-7')
    expect(Array.from(row.querySelectorAll('time')).map((time) => time.dateTime)).toEqual([
      item.plannedStart,
      item.plannedEnd,
      item.actualStart,
      item.actualEnd,
    ])
  })

  it('shows an accessible empty state', () => {
    renderTimeline([])

    expect(screen.getByRole('status').textContent).toBe('No resource plan or actual items')
  })
})
