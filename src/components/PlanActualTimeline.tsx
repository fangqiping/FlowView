import type { SchedulePlanItemModel } from '../types'
import {
  getTimelineGeometry,
  groupResourceOccupancies,
  isDelayedItem,
  resolveActualInterval,
} from '../lib/scheduling'

export interface PlanActualTimelineProps {
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

interface ItemRowProps {
  item: SchedulePlanItemModel
  resourceIdentity: string
  horizonStart: string
  horizonEnd: string
  now: string
}

function ItemRow({ item, resourceIdentity, horizonStart, horizonEnd, now }: ItemRowProps) {
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
  const identity = `${item.displayLabel}; resource ${resourceIdentity}`

  return (
    <li
      aria-label={identity}
      className={`plan-actual-row lifecycle-${lifecycleStatus.className}`}
    >
      <div className="plan-actual-row-label">
        <strong>{item.displayLabel}</strong>
        <span>Resource {resourceIdentity}</span>
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
        <span className={`plan-actual-lifecycle ${lifecycleStatus.className}`}>
          {lifecycleStatus.label}
        </span>
        <span className="plan-actual-status">{statusLabel}</span>
      </div>
      <div className="plan-actual-track">
        {plannedGeometry.widthPercent > 0 ? (
          <span
            aria-hidden="true"
            className="plan-actual-planned"
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
              'plan-actual-actual',
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

export function PlanActualTimeline({
  items,
  horizonStart,
  horizonEnd,
  now,
}: PlanActualTimelineProps) {
  const resourceGroups = groupResourceOccupancies(items)

  if (resourceGroups.length === 0) {
    return <div role="status">No resource plan or actual items</div>
  }

  return (
    <div className="plan-actual-timeline">
      {resourceGroups.map((group) => {
        const resourceIdentity = `${group.resourceType} / ${group.resourceId}`

        return (
          <section
            aria-label={resourceIdentity}
            className="plan-actual-resource-group"
            key={group.key}
            role="group"
          >
            <h3>{resourceIdentity}</h3>
            <ul className="plan-actual-items">
              {group.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  resourceIdentity={resourceIdentity}
                  horizonStart={horizonStart}
                  horizonEnd={horizonEnd}
                  now={now}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
