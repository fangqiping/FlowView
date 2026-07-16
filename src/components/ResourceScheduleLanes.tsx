import type { SchedulePlanItemModel } from '../types'
import { useI18n } from '../i18n/useI18n'
import {
  getTimelineGeometry,
  groupResourceOccupancies,
  isDelayedItem,
  resolveActualInterval,
} from '../lib/scheduling'

export interface ResourceScheduleLanesProps {
  items: SchedulePlanItemModel[]
  horizonStart: string
  horizonEnd: string
  now: string
  selectedItemId?: number | null
  onSelect(item: SchedulePlanItemModel): void
}

const STATUS_CLASSES = [
  'planned',
  'waiting',
  'running',
  'completed',
  'delayed',
  'blocked',
  'canceled',
] as const

function getStatusClass(status: number): string {
  return STATUS_CLASSES[status] ?? 'unknown'
}

export function ResourceScheduleLanes({
  items,
  horizonStart,
  horizonEnd,
  now,
  selectedItemId,
  onSelect,
}: ResourceScheduleLanesProps) {
  const { t } = useI18n()
  const lanes = groupResourceOccupancies(items)

  if (lanes.length === 0) {
    return (
      <div className="resource-schedule-lanes resource-schedule-empty" role="status">
        {t('scheduling.noResourceOccupancies')}
      </div>
    )
  }

  return (
    <div className="resource-schedule-lanes">
      {lanes.map((lane) => (
        <div className="resource-schedule-row" key={lane.key}>
          <div className="resource-schedule-label">
            {lane.resourceType} / {lane.resourceId}
          </div>
          <div className="resource-schedule-track">
            {lane.items.map((item) => {
              const started = item.actualStart !== null
              const actualInterval = started ? resolveActualInterval(item, now, horizonEnd) : null
              const interval = actualInterval ?? {
                start: item.plannedStart,
                end: item.plannedEnd,
              }
              const geometry = getTimelineGeometry(
                interval.start,
                interval.end,
                horizonStart,
                horizonEnd,
              )
              if (geometry.widthPercent <= 0) return null

              const intervalClass = actualInterval ? 'actual' : 'planned'
              const statusClass = getStatusClass(item.status)
              const classNames = [
                'resource-occupancy',
                intervalClass,
                actualInterval && item.actualEnd === null ? 'open' : null,
                statusClass !== intervalClass ? statusClass : null,
                isDelayedItem(item, now) && statusClass !== 'delayed' ? 'delayed' : null,
              ].filter((className) => className !== null).join(' ')
              const identity = t('scheduling.resourceItemIdentity', {
                label: item.displayLabel,
                flowTaskId: item.flowTaskId,
                node: item.nodeId,
                resource: `${lane.resourceType} / ${lane.resourceId}`,
              })

              return (
                <button
                  aria-label={identity}
                  aria-pressed={selectedItemId === item.id}
                  className={classNames}
                  key={item.id}
                  onClick={() => onSelect(item)}
                  style={{
                    left: `${geometry.leftPercent}%`,
                    top: actualInterval === null ? '4px' : '30px',
                    width: `${geometry.widthPercent}%`,
                  }}
                  title={identity}
                  type="button"
                >
                  {item.displayLabel}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
