import { cleanup, fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import type { SchedulePlanItemModel } from '../types'
import { ResourceScheduleLanes } from './ResourceScheduleLanes'

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

function renderLanes(items: SchedulePlanItemModel[], overrides: {
  selectedItemId?: number | null
  onSelect?: (item: SchedulePlanItemModel) => void
} = {}) {
  return render(
    <ResourceScheduleLanes
      items={items}
      horizonStart={HORIZON_START}
      horizonEnd={HORIZON_END}
      now={NOW}
      selectedItemId={overrides.selectedItemId}
      onSelect={overrides.onSelect ?? vi.fn()}
    />,
  )
}

describe('ResourceScheduleLanes', () => {
  it('groups exact resources in stable order and omits malformed and nonoccupancy items', () => {
    const items = [
      makeItem({ id: 3, resourceType: 'Vehicle', resourceId: 'AGV-2', displayLabel: 'Third' }),
      makeItem({
        id: 2,
        resourceType: 'ConsoleInfo',
        resourceId: 'StackCrane',
        displayLabel: 'Second',
        plannedStart: '2026-07-15T10:00:00.000Z',
        plannedEnd: '2026-07-15T11:00:00.000Z',
      }),
      makeItem({ id: 1, resourceType: 'ConsoleInfo', resourceId: 'StackCrane', displayLabel: 'First', plannedStart: '2026-07-15T08:30:00.000Z' }),
      makeItem({ id: 4, itemKind: 0, displayLabel: 'Flow node' }),
      makeItem({ id: 5, resourceId: null, displayLabel: 'Missing resource' }),
    ]

    const { container } = renderLanes(items)
    const rows = Array.from(container.querySelectorAll('.resource-schedule-row'))

    expect(rows).toHaveLength(2)
    expect(within(rows[0] as HTMLElement).getByText('ConsoleInfo / StackCrane')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('Vehicle / AGV-2')).toBeTruthy()
    expect(within(rows[0] as HTMLElement).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'First',
      'Second',
    ])
    expect(screen.queryByText('Flow node')).toBeNull()
    expect(screen.queryByText('Missing resource')).toBeNull()
  })

  it('passes the exact selected item and exposes task and resource identity', () => {
    const item = makeItem({
      id: 27,
      flowTaskId: 2407,
      nodeId: 'Putaway',
      resourceType: 'ConsoleInfo',
      resourceId: 'StackCrane-01',
      displayLabel: 'IN-2407 / P-018 · 上架',
    })
    const onSelect = vi.fn()

    renderLanes([item], { onSelect })
    const button = screen.getByRole('button', {
      name: /IN-2407 \/ P-018 · 上架.*FlowTask 2407.*Putaway.*ConsoleInfo.*StackCrane-01/,
    })

    expect(button.getAttribute('title')).toContain('FlowTask 2407')
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0][0]).toBe(item)
  })

  it('reflects selection with aria-pressed', () => {
    renderLanes([
      makeItem({ id: 1, displayLabel: 'Selected' }),
      makeItem({ id: 2, displayLabel: 'Not selected' }),
    ], { selectedItemId: 1 })

    expect(screen.getByRole('button', { name: /Selected/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /Not selected/ }).getAttribute('aria-pressed')).toBe('false')
  })

  it('uses open and closed actual intervals and planned intervals for geometry', () => {
    renderLanes([
      makeItem({
        id: 1,
        displayLabel: 'Open actual',
        actualStart: '2026-07-15T09:00:00.000Z',
        status: 2,
      }),
      makeItem({
        id: 2,
        displayLabel: 'Closed actual',
        actualStart: '2026-07-15T08:30:00.000Z',
        actualEnd: '2026-07-15T10:00:00.000Z',
        status: 3,
      }),
      makeItem({
        id: 3,
        displayLabel: 'Planned occupancy',
        plannedStart: '2026-07-15T10:00:00.000Z',
        plannedEnd: '2026-07-15T11:00:00.000Z',
      }),
    ])

    const open = screen.getByRole('button', { name: /Open actual/ })
    const closed = screen.getByRole('button', { name: /Closed actual/ })
    const planned = screen.getByRole('button', { name: /Planned occupancy/ })

    expect(open.getAttribute('style')).toContain('left: 25%')
    expect(open.getAttribute('style')).toContain('width: 50%')
    expect(open.className).toContain('actual')
    expect(open.className).toContain('open')
    expect(open.className).toContain('running')
    expect(open.getAttribute('style')).toContain('top: 30px')
    expect(closed.getAttribute('style')).toContain('left: 12.5%')
    expect(closed.getAttribute('style')).toContain('width: 37.5%')
    expect(closed.className).toContain('actual')
    expect(closed.className).toContain('completed')
    expect(closed.getAttribute('style')).toContain('top: 30px')
    expect(planned.getAttribute('style')).toContain('left: 50%')
    expect(planned.getAttribute('style')).toContain('width: 25%')
    expect(planned.className).toContain('planned')
    expect(planned.getAttribute('style')).toContain('top: 4px')
  })

  it('falls back to planned geometry for an invalid actual interval', () => {
    renderLanes([makeItem({
      displayLabel: 'Invalid actual',
      plannedStart: '2026-07-15T09:00:00.000Z',
      plannedEnd: '2026-07-15T10:00:00.000Z',
      actualStart: 'invalid',
      status: 2,
    })])

    const button = screen.getByRole('button', { name: /Invalid actual/ })
    expect(button.getAttribute('style')).toContain('left: 25%')
    expect(button.getAttribute('style')).toContain('width: 25%')
    expect(button.className).toContain('planned')
    expect(button.className).not.toContain('actual')
  })

  it('does not render a button for an invalid interval', () => {
    renderLanes([makeItem({
      displayLabel: 'Invalid interval',
      plannedStart: 'invalid',
    })])

    expect(screen.queryByRole('button', { name: /Invalid interval/ })).toBeNull()
  })

  it('does not render a button for a zero-duration interval', () => {
    renderLanes([makeItem({
      displayLabel: 'Zero duration',
      plannedEnd: '2026-07-15T09:00:00.000Z',
    })])

    expect(screen.queryByRole('button', { name: /Zero duration/ })).toBeNull()
  })

  it.each([
    ['before', '2026-07-15T06:00:00.000Z', '2026-07-15T07:00:00.000Z'],
    ['after', '2026-07-15T13:00:00.000Z', '2026-07-15T14:00:00.000Z'],
  ])('does not render a button for an interval entirely %s the horizon', (_position, plannedStart, plannedEnd) => {
    renderLanes([makeItem({
      displayLabel: 'Outside horizon',
      plannedStart,
      plannedEnd,
    })])

    expect(screen.queryByRole('button', { name: /Outside horizon/ })).toBeNull()
  })

  it('uses an unknown class for a runtime status outside the wire union', () => {
    const item = {
      ...makeItem({ displayLabel: 'Unknown status' }),
      status: 99,
    } as unknown as SchedulePlanItemModel

    renderLanes([item])

    expect(screen.getByRole('button', { name: /Unknown status/ }).className.split(' ')).toContain('unknown')
  })

  it('does not render progress or percentage text', () => {
    renderLanes([makeItem({ displayLabel: 'Move pallet' })])

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/progress|\d+%/i)).toBeNull()
  })

  it('shows an accessible empty state', () => {
    renderLanes([])

    expect(screen.getByRole('status').textContent).toBe('No resource occupancies')
  })
})
