import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SchedulePlanItemModel } from '../types'
import { FlowScheduleTimeline } from './FlowScheduleTimeline'

const HORIZON_START = '2026-07-15T08:00:00.000Z'
const HORIZON_END = '2026-07-15T12:00:00.000Z'
const NOW = '2026-07-15T11:00:00.000Z'

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

function renderTimeline(items: SchedulePlanItemModel[]) {
  return render(
    <FlowScheduleTimeline
      items={items}
      horizonStart={HORIZON_START}
      horizonEnd={HORIZON_END}
      now={NOW}
    />,
  )
}

describe('FlowScheduleTimeline', () => {
  it('renders NodeExecution items only and groups FlowTasks in ascending numeric order', () => {
    renderTimeline([
      makeItem({ id: 1, flowTaskId: 20, displayLabel: 'Flow twenty' }),
      makeItem({ id: 2, flowTaskId: 3, displayLabel: 'Flow three' }),
      makeItem({ id: 3, itemKind: 1, displayLabel: 'Resource occupancy' }),
      makeItem({ id: 4, itemKind: 2, displayLabel: 'Flow summary' }),
    ])

    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual([
      'FlowTask 3',
      'FlowTask 20',
    ])
    expect(screen.queryByText('Resource occupancy')).toBeNull()
    expect(screen.queryByText('Flow summary')).toBeNull()
  })

  it('sorts rows by valid planned times, occurrence, and id with invalid dates last', () => {
    renderTimeline([
      makeItem({ id: 8, displayLabel: 'Invalid start', plannedStart: 'invalid' }),
      makeItem({ id: 7, displayLabel: 'Invalid end', plannedEnd: 'invalid' }),
      makeItem({ id: 6, displayLabel: 'Later', plannedStart: '2026-07-15T10:00:00.000Z' }),
      makeItem({ id: 5, displayLabel: 'Occurrence two', occurrence: 2 }),
      makeItem({ id: 4, displayLabel: 'Occurrence one high id', occurrence: 1 }),
      makeItem({ id: 3, displayLabel: 'Occurrence one low id', occurrence: 1 }),
      makeItem({ id: 2, displayLabel: 'Earlier end', plannedEnd: '2026-07-15T09:30:00.000Z' }),
    ])

    expect(screen.getAllByRole('listitem').map((row) => row.getAttribute('aria-label'))).toEqual([
      expect.stringContaining('Earlier end'),
      expect.stringContaining('Occurrence one low id'),
      expect.stringContaining('Occurrence one high id'),
      expect.stringContaining('Occurrence two'),
      expect.stringContaining('Invalid end'),
      expect.stringContaining('Later'),
      expect.stringContaining('Invalid start'),
    ])
  })

  it('visibly identifies node, occurrence, and display label', () => {
    renderTimeline([makeItem({ displayLabel: 'Load pallet', nodeId: 'Load', occurrence: 3 })])

    const row = screen.getByRole('listitem', { name: /Load pallet.*node Load.*occurrence 3/i })
    expect(within(row).getByText('Load pallet')).toBeTruthy()
    expect(row.textContent).toContain('Node Load')
    expect(row.textContent).toContain('Occurrence 3')
  })

  it('renders planned and closed actual geometry with visible delayed state', () => {
    renderTimeline([makeItem({
      displayLabel: 'Late node',
      actualStart: '2026-07-15T09:30:00.000Z',
      actualEnd: '2026-07-15T10:30:00.000Z',
      status: 3,
    })])

    const row = screen.getByRole('listitem', { name: /Late node/ })
    expect(row.querySelector('.flow-schedule-planned')).not.toBeNull()
    expect(row.querySelector('.flow-schedule-actual')?.classList.contains('delayed')).toBe(true)
    expect(within(row).getByText('Delayed')).toBeTruthy()
  })

  it('ends open actual geometry at now and exposes open state', () => {
    renderTimeline([makeItem({
      displayLabel: 'Running node',
      actualStart: '2026-07-15T09:00:00.000Z',
      actualEnd: null,
      status: 2,
    })])

    const row = screen.getByRole('listitem', { name: /Running node/ })
    const actual = row.querySelector('.flow-schedule-actual')
    expect(actual?.getAttribute('style')).toContain('left: 25%')
    expect(actual?.getAttribute('style')).toContain('width: 50%')
    expect(actual?.classList.contains('open')).toBe(true)
    expect(within(row).getByText(/Open/)).toBeTruthy()
  })

  it('shows unstarted state without an actual bar', () => {
    renderTimeline([makeItem({ displayLabel: 'Queued node' })])

    const row = screen.getByRole('listitem', { name: /Queued node/ })
    expect(row.querySelector('.flow-schedule-planned')).not.toBeNull()
    expect(row.querySelector('.flow-schedule-actual')).toBeNull()
    expect(within(row).getByText('Not started')).toBeTruthy()
  })

  it.each([
    [4, 'Delayed', 'delayed'],
    [5, 'Blocked', 'blocked'],
    [6, 'Canceled', 'canceled'],
    [99, 'Unknown (99)', 'unknown'],
  ])('preserves lifecycle status %s independently from timing state', (status, label, statusClass) => {
    const item = {
      ...makeItem({ displayLabel: `${label} node` }),
      status,
    } as SchedulePlanItemModel

    renderTimeline([item])

    const row = screen.getByRole('listitem', {
      name: (accessibleName) => accessibleName.includes(`${label} node`),
    })
    const lifecycle = within(row).getByText(label)
    expect(lifecycle.classList.contains('flow-schedule-lifecycle')).toBe(true)
    expect(lifecycle.classList.contains(statusClass)).toBe(true)
    expect(row.classList.contains(`lifecycle-${statusClass}`)).toBe(true)
    expect(within(row).getByText('Not started')).toBeTruthy()
  })

  it('does not mutate the input array while grouping and sorting', () => {
    const first = makeItem({ id: 2, flowTaskId: 20, displayLabel: 'First input' })
    const second = makeItem({ id: 1, flowTaskId: 3, displayLabel: 'Second input' })
    const items = [first, second]
    const snapshot = [...items]

    renderTimeline(items)

    expect(items).toEqual(snapshot)
    expect(items[0]).toBe(first)
    expect(items[1]).toBe(second)
  })

  it('keeps row text while omitting zero-width geometry', () => {
    renderTimeline([makeItem({
      displayLabel: 'Zero node',
      plannedEnd: '2026-07-15T09:00:00.000Z',
      actualStart: '2026-07-15T10:00:00.000Z',
      actualEnd: '2026-07-15T10:00:00.000Z',
    })])

    const row = screen.getByRole('listitem', { name: /Zero node/ })
    expect(row.querySelector('.flow-schedule-planned')).toBeNull()
    expect(row.querySelector('.flow-schedule-actual')).toBeNull()
  })

  it('shows an accessible empty state', () => {
    renderTimeline([])

    expect(screen.getByRole('status').textContent).toBe('No flow schedule items')
  })
})
