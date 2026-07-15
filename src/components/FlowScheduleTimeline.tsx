import type { SchedulePlanItemModel } from '../types'
import {
  getTimelineGeometry,
  isDelayedItem,
  resolveActualInterval,
} from '../lib/scheduling'

export interface FlowScheduleTimelineProps {
  items: SchedulePlanItemModel[]
  horizonStart: string
  horizonEnd: string
  now: string
}

const LIFECYCLE_STATUS_LABELS = [
  'Planned',
  'Waiting',
  'Running',
  'Completed',
  'Delayed',
  'Blocked',
  'Canceled',
] as const

const LIFECYCLE_STATUS_CLASSES = [
  'planned',
  'waiting',
  'running',
  'completed',
  'delayed',
  'blocked',
  'canceled',
] as const

function getLifecycleStatus(status: number): { label: string; className: string } {
  return {
    label: LIFECYCLE_STATUS_LABELS[status] ?? `Unknown (${status})`,
    className: LIFECYCLE_STATUS_CLASSES[status] ?? 'unknown',
  }
}

interface FlowTaskGroup {
  flowTaskId: number
  items: SchedulePlanItemModel[]
}

const ISO_DATE_TIME_OFFSET_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(Z|([+-])(\d{2}):(\d{2}))$/

function parseDate(value: string): number | null {
  const match = ISO_DATE_TIME_OFFSET_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const fraction = match[7]
  const offsetHour = match[10] === undefined ? 0 : Number(match[10])
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11])
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  if (
    year < 1
    || month < 1
    || month > 12
    || day < 1
    || day > daysInMonth[month - 1]
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHour > 14
    || offsetMinute > 59
    || (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return null
  }

  const parseableValue = fraction && fraction.length > 3
    ? value.replace(`.${fraction}`, `.${fraction.slice(0, 3)}`)
    : value
  const timestamp = Date.parse(parseableValue)
  return Number.isFinite(timestamp) ? timestamp : null
}

function compareDates(left: string, right: string): number {
  const leftTime = parseDate(left)
  const rightTime = parseDate(right)

  if (leftTime === null) return rightTime === null ? 0 : 1
  if (rightTime === null) return -1
  return leftTime - rightTime
}

function compareItems(left: SchedulePlanItemModel, right: SchedulePlanItemModel): number {
  return compareDates(left.plannedStart, right.plannedStart)
    || compareDates(left.plannedEnd, right.plannedEnd)
    || left.occurrence - right.occurrence
    || left.id - right.id
}

function groupNodeExecutions(items: SchedulePlanItemModel[]): FlowTaskGroup[] {
  const groups = new Map<number, SchedulePlanItemModel[]>()

  for (const item of items) {
    if (item.itemKind !== 0) continue
    const groupItems = groups.get(item.flowTaskId)
    if (groupItems) groupItems.push(item)
    else groups.set(item.flowTaskId, [item])
  }

  return Array.from(groups, ([flowTaskId, groupItems]) => ({
    flowTaskId,
    items: [...groupItems].sort(compareItems),
  })).sort((left, right) => left.flowTaskId - right.flowTaskId)
}

interface FlowItemRowProps {
  item: SchedulePlanItemModel
  horizonStart: string
  horizonEnd: string
  now: string
}

function FlowItemRow({ item, horizonStart, horizonEnd, now }: FlowItemRowProps) {
  const plannedGeometry = getTimelineGeometry(
    item.plannedStart,
    item.plannedEnd,
    horizonStart,
    horizonEnd,
  )
  const actualInterval = resolveActualInterval(item, now, horizonEnd)
  const actualGeometry = actualInterval === null
    ? null
    : getTimelineGeometry(actualInterval.start, actualInterval.end, horizonStart, horizonEnd)
  const delayed = actualInterval !== null && isDelayedItem(item, now)
  const statusLabel = actualInterval === null ? 'Not started' : delayed ? 'Delayed' : 'On time'
  const lifecycleStatus = getLifecycleStatus(item.status)
  const identity = `${item.displayLabel}; node ${item.nodeId}; occurrence ${item.occurrence}`

  return (
    <li
      aria-label={identity}
      className={`flow-schedule-row lifecycle-${lifecycleStatus.className}`}
    >
      <div className="flow-schedule-row-label">
        <strong>{item.displayLabel}</strong>
        <span>Node {item.nodeId}</span>
        <span>Occurrence {item.occurrence}</span>
        <span>
          Planned{' '}
          <time dateTime={item.plannedStart}>{item.plannedStart}</time>
          {' - '}
          <time dateTime={item.plannedEnd}>{item.plannedEnd}</time>
        </span>
        <span>
          Actual{' '}
          {actualInterval === null ? 'Not started' : (
            <>
              <time dateTime={actualInterval.start}>{actualInterval.start}</time>
              {item.actualEnd === null ? (
                <>
                  {' Open through '}
                  <time dateTime={actualInterval.end}>{actualInterval.end}</time>
                </>
              ) : (
                <>
                  {' - '}
                  <time dateTime={actualInterval.end}>{actualInterval.end}</time>
                </>
              )}
            </>
          )}
        </span>
        <span className={`flow-schedule-lifecycle ${lifecycleStatus.className}`}>
          {lifecycleStatus.label}
        </span>
        <span className="flow-schedule-status">{statusLabel}</span>
      </div>
      <div className="flow-schedule-track">
        {plannedGeometry.widthPercent > 0 ? (
          <span
            aria-hidden="true"
            className="flow-schedule-planned"
            style={{
              left: `${plannedGeometry.leftPercent}%`,
              width: `${plannedGeometry.widthPercent}%`,
            }}
          />
        ) : null}
        {actualGeometry !== null && actualGeometry.widthPercent > 0 ? (
          <span
            aria-hidden="true"
            className={[
              'flow-schedule-actual',
              delayed ? 'delayed' : 'on-time',
              item.actualEnd === null ? 'open' : null,
            ].filter(Boolean).join(' ')}
            style={{
              left: `${actualGeometry.leftPercent}%`,
              width: `${actualGeometry.widthPercent}%`,
            }}
          />
        ) : null}
      </div>
    </li>
  )
}

export function FlowScheduleTimeline({
  items,
  horizonStart,
  horizonEnd,
  now,
}: FlowScheduleTimelineProps) {
  const flowTaskGroups = groupNodeExecutions(items)

  if (flowTaskGroups.length === 0) {
    return <div role="status">No flow schedule items</div>
  }

  return (
    <div className="flow-schedule-timeline">
      {flowTaskGroups.map((group) => (
        <section
          aria-label={`FlowTask ${group.flowTaskId}`}
          className="flow-schedule-group"
          key={group.flowTaskId}
          role="group"
        >
          <h3>FlowTask {group.flowTaskId}</h3>
          <ul className="flow-schedule-items">
            {group.items.map((item) => (
              <FlowItemRow
                key={item.id}
                item={item}
                horizonStart={horizonStart}
                horizonEnd={horizonEnd}
                now={now}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
