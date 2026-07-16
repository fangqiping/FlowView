import { describe, expect, it } from 'vitest'
import type { SchedulePlanItemModel } from '../types'
import {
  formatScheduleDeviation,
  getTimelineGeometry,
  groupResourceOccupancies,
  isDelayedItem,
  resolveActualInterval,
} from './scheduling'

const HORIZON_START = '2026-07-15T08:00:00.000Z'
const HORIZON_END = '2026-07-15T10:00:00.000Z'

function makeItem(overrides: Partial<SchedulePlanItemModel> = {}): SchedulePlanItemModel {
  return {
    id: 1,
    planId: 10,
    itemKind: 1,
    flowTaskId: 100,
    nodeId: 'Move',
    occurrence: 0,
    operationTaskId: null,
    plannedStart: '2026-07-15T08:30:00.000Z',
    plannedEnd: '2026-07-15T09:00:00.000Z',
    actualStart: null,
    actualEnd: null,
    predictedEnd: null,
    expectedDuration: '00:30:00',
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

describe('groupResourceOccupancies', () => {
  it('groups only resource occupancies by exact resource type and id', () => {
    const items = [
      makeItem({ id: 1, resourceType: 'ConsoleInfo', resourceId: 'StackCrane' }),
      makeItem({ id: 2, resourceType: 'ConsoleInfo', resourceId: 'StackCrane' }),
      makeItem({ id: 3, resourceType: 'consoleInfo', resourceId: 'StackCrane' }),
      makeItem({ id: 4, itemKind: 0, resourceType: 'ConsoleInfo', resourceId: 'StackCrane' }),
      makeItem({ id: 5, itemKind: 2, resourceType: 'ConsoleInfo', resourceId: 'StackCrane' }),
    ]

    const lanes = groupResourceOccupancies(items)

    expect(lanes.map((lane) => [lane.key, lane.items.map((item) => item.id)])).toEqual([
      ['ConsoleInfo/StackCrane', [1, 2]],
      ['consoleInfo/StackCrane', [3]],
    ])
  })

  it('ignores resource occupancies without a resource type or resource id', () => {
    const lanes = groupResourceOccupancies([
      makeItem({ id: 1, resourceType: null }),
      makeItem({ id: 2, resourceId: null }),
      makeItem({ id: 3, resourceType: '' }),
      makeItem({ id: 4, resourceId: '' }),
      makeItem({ id: 5, resourceType: 'ConsoleInfo', resourceId: 'Conveyor' }),
    ])

    expect(lanes).toHaveLength(1)
    expect(lanes[0]).toMatchObject({
      key: 'ConsoleInfo/Conveyor',
      resourceType: 'ConsoleInfo',
      resourceId: 'Conveyor',
    })
  })

  it('sorts lanes by their exact resource key', () => {
    const lanes = groupResourceOccupancies([
      makeItem({ id: 1, resourceType: 'Vehicle', resourceId: '2' }),
      makeItem({ id: 2, resourceType: 'ConsoleInfo', resourceId: 'StackCrane' }),
      makeItem({ id: 3, resourceType: 'ConsoleInfo', resourceId: 'Conveyor' }),
    ])

    expect(lanes.map((lane) => lane.key)).toEqual([
      'ConsoleInfo/Conveyor',
      'ConsoleInfo/StackCrane',
      'Vehicle/2',
    ])
  })

  it('escapes composite key components and sorts lanes by the raw resource tuple', () => {
    const items = [
      makeItem({ id: 1, resourceType: 'a/b', resourceId: 'c' }),
      makeItem({ id: 2, resourceType: 'a', resourceId: 'b/c' }),
      makeItem({ id: 3, resourceType: 'a%2Fb', resourceId: 'c' }),
    ]
    const expected = [
      { key: 'a/b%2Fc', resourceType: 'a', resourceId: 'b/c' },
      { key: 'a%252Fb/c', resourceType: 'a%2Fb', resourceId: 'c' },
      { key: 'a%2Fb/c', resourceType: 'a/b', resourceId: 'c' },
    ]

    const summarize = (source: SchedulePlanItemModel[]) => groupResourceOccupancies(source)
      .map(({ key, resourceType, resourceId }) => ({ key, resourceType, resourceId }))

    expect(summarize(items)).toEqual(expected)
    expect(summarize([...items].reverse())).toEqual(expected)
  })

  it('sorts lane items by planned start, planned end, and id with invalid dates last', () => {
    const lanes = groupResourceOccupancies([
      makeItem({ id: 8, plannedStart: 'invalid', plannedEnd: '2026-07-15T08:00:00.000Z' }),
      makeItem({ id: 6, plannedStart: '2026-07-15T08:00:00.000Z', plannedEnd: 'invalid' }),
      makeItem({ id: 5, plannedStart: '2026-07-15T08:00:00.000Z', plannedEnd: '2026-07-15T09:00:00.000Z' }),
      makeItem({ id: 4, plannedStart: '2026-07-15T08:00:00.000Z', plannedEnd: '2026-07-15T09:00:00.000Z' }),
      makeItem({ id: 3, plannedStart: '2026-07-15T07:00:00.000Z', plannedEnd: '2026-07-15T10:00:00.000Z' }),
      makeItem({ id: 7, plannedStart: 'invalid', plannedEnd: 'invalid' }),
    ])

    expect(lanes[0].items.map((item) => item.id)).toEqual([3, 4, 5, 6, 8, 7])
  })
})

describe('getTimelineGeometry', () => {
  it('clamps an interval to the horizon and returns percentage geometry', () => {
    expect(getTimelineGeometry(
      '2026-07-15T07:30:00.000Z',
      '2026-07-15T09:00:00.000Z',
      HORIZON_START,
      HORIZON_END,
    )).toEqual({ leftPercent: 0, widthPercent: 50 })

    expect(getTimelineGeometry(
      '2026-07-15T09:30:00.000Z',
      '2026-07-15T10:30:00.000Z',
      HORIZON_START,
      HORIZON_END,
    )).toEqual({ leftPercent: 75, widthPercent: 25 })
  })

  it('accepts .NET ISO timestamps with offsets and up to seven fractional digits', () => {
    expect(getTimelineGeometry(
      '2026-07-15T08:30:00.0000000+08:00',
      '2026-07-15T09:00:00.0000000+08:00',
      '2026-07-15T08:00:00+08:00',
      '2026-07-15T10:00:00+08:00',
    )).toEqual({ leftPercent: 25, widthPercent: 25 })

    expect(getTimelineGeometry(
      '2026-07-15T08:30:00-04:00',
      '2026-07-15T09:00:00-04:00',
      '2026-07-15T08:00:00-04:00',
      '2026-07-15T10:00:00-04:00',
    )).toEqual({ leftPercent: 25, widthPercent: 25 })
  })

  it.each([
    ['missing timezone', '2026-07-15T08:00:00.000'],
    ['impossible calendar date', '2026-02-30T00:00:00.000Z'],
    ['invalid clock', '2026-07-15T24:00:00.000Z'],
    ['invalid timezone offset', '2026-07-15T08:00:00.000+14:01'],
    ['too many fractional digits', '2026-07-15T08:00:00.00000000Z'],
  ])('rejects a timestamp with %s', (_label, end) => {
    expect(getTimelineGeometry(
      '2026-02-01T00:00:00.000Z',
      end,
      '2026-02-01T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
    )).toEqual({ leftPercent: 0, widthPercent: 0 })
  })

  it.each([
    ['invalid interval start', 'invalid', HORIZON_END, HORIZON_START, HORIZON_END],
    ['invalid interval end', HORIZON_START, 'invalid', HORIZON_START, HORIZON_END],
    ['reversed interval', HORIZON_END, HORIZON_START, HORIZON_START, HORIZON_END],
    ['invalid horizon start', HORIZON_START, HORIZON_END, 'invalid', HORIZON_END],
    ['invalid horizon end', HORIZON_START, HORIZON_END, HORIZON_START, 'invalid'],
    ['zero horizon', HORIZON_START, HORIZON_END, HORIZON_START, HORIZON_START],
    ['reversed horizon', HORIZON_START, HORIZON_END, HORIZON_END, HORIZON_START],
  ])('returns finite zero geometry for an %s', (_label, start, end, horizonStart, horizonEnd) => {
    const geometry = getTimelineGeometry(start, end, horizonStart, horizonEnd)

    expect(geometry).toEqual({ leftPercent: 0, widthPercent: 0 })
    expect(Number.isFinite(geometry.leftPercent)).toBe(true)
    expect(Number.isFinite(geometry.widthPercent)).toBe(true)
  })

  it('returns zero width with a clamped left position for intervals outside the horizon', () => {
    expect(getTimelineGeometry(
      '2026-07-15T06:00:00.000Z',
      '2026-07-15T07:00:00.000Z',
      HORIZON_START,
      HORIZON_END,
    )).toEqual({ leftPercent: 0, widthPercent: 0 })

    expect(getTimelineGeometry(
      '2026-07-15T11:00:00.000Z',
      '2026-07-15T12:00:00.000Z',
      HORIZON_START,
      HORIZON_END,
    )).toEqual({ leftPercent: 100, widthPercent: 0 })
  })
})

describe('resolveActualInterval', () => {
  it('ends an open actual occupancy at the earlier of now and the horizon end', () => {
    const item = makeItem({ actualStart: '2026-07-15T08:15:00.000Z' })

    expect(resolveActualInterval(item, '2026-07-15T09:00:00.000Z', HORIZON_END)).toEqual({
      start: item.actualStart,
      end: '2026-07-15T09:00:00.000Z',
    })
    expect(resolveActualInterval(item, '2026-07-15T11:00:00.000Z', HORIZON_END)).toEqual({
      start: item.actualStart,
      end: HORIZON_END,
    })
  })

  it('uses the actual end for a closed occupancy', () => {
    const item = makeItem({
      actualStart: '2026-07-15T08:15:00.000Z',
      actualEnd: '2026-07-15T09:15:00.000Z',
    })

    expect(resolveActualInterval(item, 'invalid', 'invalid')).toEqual({
      start: item.actualStart,
      end: item.actualEnd,
    })
  })

  it.each([
    ['missing start', null, null, '2026-07-15T09:00:00.000Z', HORIZON_END],
    ['invalid start', 'invalid', null, '2026-07-15T09:00:00.000Z', HORIZON_END],
    ['invalid closed end', '2026-07-15T08:00:00.000Z', 'invalid', '2026-07-15T09:00:00.000Z', HORIZON_END],
    ['invalid open now', '2026-07-15T08:00:00.000Z', null, 'invalid', HORIZON_END],
    ['invalid open horizon', '2026-07-15T08:00:00.000Z', null, '2026-07-15T09:00:00.000Z', 'invalid'],
    ['end before start', '2026-07-15T09:00:00.000Z', '2026-07-15T08:00:00.000Z', '2026-07-15T10:00:00.000Z', HORIZON_END],
  ])('returns null for an item with %s', (_label, actualStart, actualEnd, now, horizonEnd) => {
    expect(resolveActualInterval(makeItem({ actualStart, actualEnd }), now, horizonEnd)).toBeNull()
  })
})

describe('formatScheduleDeviation', () => {
  it.each([
    ['2026-07-15T09:00:00.000Z', '2026-07-15T09:00:00.000Z', '0s'],
    ['2026-07-15T09:00:00.000Z', '2026-07-15T09:00:00.499Z', '+1s'],
    ['2026-07-15T09:00:00.000Z', '2026-07-15T08:59:59.501Z', '-1s'],
    ['2026-07-15T09:00:00.000Z', '2026-07-15T09:00:30.000Z', '+30s'],
    ['2026-07-15T09:01:30.000Z', '2026-07-15T09:00:00.000Z', '-1m 30s'],
    ['2026-07-15T09:00:00.000Z', '2026-07-15T10:02:00.000Z', '+1h 2m'],
  ])('formats planned %s and observed %s as %s', (plannedEnd, observedEnd, expected) => {
    expect(formatScheduleDeviation(plannedEnd, observedEnd)).toBe(expected)
  })

  it.each([
    ['invalid', '2026-07-15T09:00:00.000Z'],
    ['2026-02-30T00:00:00.000Z', '2026-03-02T00:00:00.000Z'],
    ['2026-07-15T09:00:00.000Z', 'invalid'],
    ['2026-07-15T09:00:00.000Z', null],
    ['2026-07-15T09:00:00.000Z', undefined],
  ])('returns a placeholder for invalid or missing inputs', (plannedEnd, observedEnd) => {
    expect(formatScheduleDeviation(plannedEnd, observedEnd)).toBe('--')
  })
})

describe('isDelayedItem', () => {
  it('uses delayed server status as authoritative', () => {
    expect(isDelayedItem(makeItem({ status: 4, plannedEnd: 'invalid' }), 'invalid')).toBe(true)
  })

  it('detects late, on-time, and early completed items', () => {
    expect(isDelayedItem(makeItem({ actualEnd: '2026-07-15T09:00:01.000Z' }))).toBe(true)
    expect(isDelayedItem(makeItem({ actualEnd: '2026-07-15T09:00:00.000Z' }))).toBe(false)
    expect(isDelayedItem(makeItem({ actualEnd: '2026-07-15T08:59:59.000Z' }))).toBe(false)
  })

  it('detects an open started item that is past its planned end', () => {
    const item = makeItem({ actualStart: '2026-07-15T08:45:00.000Z' })

    expect(isDelayedItem(item, '2026-07-15T09:00:01.000Z')).toBe(true)
    expect(isDelayedItem(item, '2026-07-15T09:00:00.000Z')).toBe(false)
  })

  it('does not infer delay from invalid timestamps or predicted end', () => {
    expect(isDelayedItem(makeItem({ plannedEnd: 'invalid', actualEnd: HORIZON_END }), HORIZON_END)).toBe(false)
    expect(isDelayedItem(makeItem({
      plannedEnd: '2026-02-30T00:00:00.000Z',
      actualEnd: '2026-03-03T00:00:00.000Z',
    }))).toBe(false)
    expect(isDelayedItem(makeItem({ actualStart: 'invalid' }), HORIZON_END)).toBe(false)
    expect(isDelayedItem(makeItem({ actualStart: HORIZON_START }), 'invalid')).toBe(false)
    expect(isDelayedItem(makeItem({ predictedEnd: HORIZON_END }), HORIZON_END)).toBe(false)
  })
})
