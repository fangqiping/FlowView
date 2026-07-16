import { cleanup, render as rtlRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import type { SchedulePlanItemModel } from '../types'
import { ScheduleItemDetails } from './ScheduleItemDetails'

const NOW = '2026-07-15T10:30:00.000Z'

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
    flowTaskId: 2407,
    nodeId: 'Putaway',
    occurrence: 2,
    operationTaskId: 18,
    plannedStart: '2026-07-15T09:00:00.000Z',
    plannedEnd: '2026-07-15T10:00:00.000Z',
    actualStart: '2026-07-15T09:15:00.000Z',
    actualEnd: '2026-07-15T10:15:00.000Z',
    predictedEnd: null,
    expectedDuration: '01:00:00',
    status: 3,
    resourceType: 'ConsoleInfo',
    resourceId: 'StackCrane-01',
    occupancyIndex: 0,
    displayLabel: 'IN-2407 / P-018 · 上架',
    displayContextJson: JSON.stringify({
      orderType: 'Inbound',
      orderId: 2407,
      orderCode: 'IN-2407',
      sku: 'SKU-018',
      pallet: 'P-018',
      sourceLocation: 'DOCK-1',
      requestedSourceLocation: 'DOCK',
      targetLocation: 'RACK-A1',
      requestedTargetLocation: 'RACK-A',
    }),
    delayReason: 'Crane unavailable',
    isFrozen: true,
    ...overrides,
  }
}

function detailValue(label: string): string | null {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.nextElementSibling?.textContent ?? null
}

describe('ScheduleItemDetails', () => {
  it('renders exact task identity, context, timing, status, delay, and frozen fields', () => {
    const item = makeItem()
    const { container } = render(<ScheduleItemDetails item={item} now={NOW} />)

    expect(detailValue('FlowTask')).toBe('2407')
    expect(detailValue('OperationTask')).toBe('18')
    expect(detailValue('Order')).toBe('IN-2407')
    expect(detailValue('Pallet')).toBe('P-018')
    expect(detailValue('SKU')).toBe('SKU-018')
    expect(detailValue('Node')).toBe('Putaway')
    expect(detailValue('Occurrence')).toBe('2')
    expect(detailValue('Resource')).toBe('ConsoleInfo / StackCrane-01')
    expect(detailValue('Status')).toBe('Completed')
    expect(detailValue('Planned')).toBe('2026-07-15T09:00:00.000Z – 2026-07-15T10:00:00.000Z')
    expect(detailValue('Actual')).toBe('2026-07-15T09:15:00.000Z – 2026-07-15T10:15:00.000Z')
    expect(detailValue('Deviation')).toBe('+15m')
    expect(detailValue('Delay reason')).toBe('Crane unavailable')
    expect(detailValue('Frozen')).toBe('Yes')
    expect(detailValue('Source location')).toBe('DOCK-1')
    expect(detailValue('Requested source location')).toBe('DOCK')
    expect(detailValue('Target location')).toBe('RACK-A1')
    expect(detailValue('Requested target location')).toBe('RACK-A')
    expect(Array.from(container.querySelectorAll('time')).map((time) => time.getAttribute('datetime'))).toEqual([
      item.plannedStart,
      item.plannedEnd,
      item.actualStart,
      item.actualEnd,
    ])
  })

  it('uses actual end ahead of predicted end and now for deviation', () => {
    render(<ScheduleItemDetails item={makeItem({
      predictedEnd: '2026-07-15T10:45:00.000Z',
    })} now={NOW} />)

    expect(detailValue('Deviation')).toBe('+15m')
  })

  it('renders a null operation task and an open actual occupancy', () => {
    render(<ScheduleItemDetails item={makeItem({
      operationTaskId: null,
      actualStart: '2026-07-15T09:00:00.000Z',
      actualEnd: null,
      predictedEnd: '2026-07-15T10:20:00.000Z',
      status: 2,
      isFrozen: false,
    })} now={NOW} />)

    expect(detailValue('OperationTask')).toBe('--')
    expect(detailValue('Actual')).toBe('2026-07-15T09:00:00.000Z Open')
    expect(detailValue('Deviation')).toBe('+20m')
    expect(detailValue('Status')).toBe('Running')
    expect(detailValue('Frozen')).toBe('No')
    expect(screen.getAllByText('2026-07-15T09:00:00.000Z', { selector: 'time' })
      .some((time) => time.getAttribute('datetime') === '2026-07-15T09:00:00.000Z')).toBe(true)
  })

  it('uses current overrun for an open item without a predicted end', () => {
    render(<ScheduleItemDetails item={makeItem({
      actualEnd: null,
      predictedEnd: null,
      status: 2,
    })} now={NOW} />)

    expect(detailValue('Deviation')).toBe('+30m')
  })

  it.each([
    ['before', '2026-07-15T09:30:00.000Z'],
    ['on', '2026-07-15T10:00:00.000Z'],
  ])('does not report early completion %s the planned end for an open item', (_position, now) => {
    render(<ScheduleItemDetails item={makeItem({
      actualEnd: null,
      predictedEnd: null,
      status: 2,
    })} now={now} />)

    expect(detailValue('Deviation')).toBe('--')
  })

  it('falls back to current overrun when an open item has an invalid predicted end', () => {
    render(<ScheduleItemDetails item={makeItem({
      actualEnd: null,
      predictedEnd: 'invalid',
      status: 2,
    })} now={NOW} />)

    expect(detailValue('Deviation')).toBe('+30m')
  })

  it('uses predicted end for the deviation of an unstarted item', () => {
    render(<ScheduleItemDetails item={makeItem({
      actualStart: null,
      actualEnd: null,
      predictedEnd: '2026-07-15T10:20:00.000Z',
      status: 1,
    })} now={NOW} />)

    expect(detailValue('Actual')).toBe('--')
    expect(detailValue('Deviation')).toBe('+20m')
    expect(detailValue('Status')).toBe('Waiting')
  })

  it('gracefully falls back when display context JSON is invalid or not an object', () => {
    const { rerender } = render(<ScheduleItemDetails item={makeItem({ displayContextJson: '{bad json' })} now={NOW} />)

    expect(detailValue('Order')).toBe('--')
    expect(detailValue('Pallet')).toBe('--')
    expect(detailValue('SKU')).toBe('--')

    rerender(<ScheduleItemDetails item={makeItem({ displayContextJson: '[]' })} now={NOW} />)
    expect(detailValue('Order')).toBe('--')
  })

  it('uses order id when order code is missing', () => {
    render(<ScheduleItemDetails item={makeItem({
      displayContextJson: JSON.stringify({ orderId: 2407 }),
    })} now={NOW} />)

    expect(detailValue('Order')).toBe('2407')
  })

  it('ignores inherited display context values', () => {
    const inheritedKeys = ['orderCode', 'orderId', 'pallet', 'sku', 'sourceLocation']
    Object.defineProperties(Object.prototype, Object.fromEntries(inheritedKeys.map((key) => [
      key,
      { configurable: true, value: `Inherited ${key}` },
    ])))

    try {
      render(<ScheduleItemDetails item={makeItem({ displayContextJson: '{}' })} now={NOW} />)

      expect(detailValue('Order')).toBe('--')
      expect(detailValue('Pallet')).toBe('--')
      expect(detailValue('SKU')).toBe('--')
      expect(screen.queryByText('Source location', { selector: 'dt' })).toBeNull()
    } finally {
      inheritedKeys.forEach((key) => Reflect.deleteProperty(Object.prototype, key))
    }
  })

  it('shows an unknown fallback for a runtime status outside the wire union', () => {
    const item = {
      ...makeItem(),
      status: 99,
    } as unknown as SchedulePlanItemModel

    render(<ScheduleItemDetails item={item} now={NOW} />)

    expect(detailValue('Status')).toBe('Unknown (99)')
  })

  it('renders a compact empty inspector state for a null item', () => {
    render(<ScheduleItemDetails item={null} now={NOW} />)

    expect(screen.getByRole('status').textContent).toBe('Select a schedule item')
  })
})
