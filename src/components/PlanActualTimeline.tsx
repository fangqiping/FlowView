import type { SchedulePlanItemModel } from '../types'
import type { MessageKey } from '../i18n/messages'
import { useI18n } from '../i18n/useI18n'
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

const LIFECYCLE_STATUS_KEYS: MessageKey[] = [
  'scheduling.statusPlanned',
  'scheduling.statusWaiting',
  'scheduling.statusRunning',
  'scheduling.statusCompleted',
  'scheduling.statusDelayed',
  'scheduling.statusBlocked',
  'scheduling.statusCanceled',
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

function getLifecycleStatus(status: number): { labelKey: MessageKey | null; className: string } {
  return {
    labelKey: LIFECYCLE_STATUS_KEYS[status] ?? null,
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
  const { t } = useI18n()
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
  const statusLabel = actualInterval === null
    ? t('scheduling.notStarted')
    : delayed
      ? t('scheduling.statusDelayed')
      : t('scheduling.onTime')
  const lifecycleStatus = getLifecycleStatus(item.status)
  const identity = t('scheduling.planActualItemIdentity', {
    label: item.displayLabel,
    resource: resourceIdentity,
  })

  return (
    <li
      aria-label={identity}
      className={`plan-actual-row lifecycle-${lifecycleStatus.className}`}
    >
      <div className="plan-actual-row-label">
        <strong>{item.displayLabel}</strong>
        <span>{t('scheduling.resourceValue', { resource: resourceIdentity })}</span>
        <span>
          {t('scheduling.planned')}{' '}
          <time dateTime={item.plannedStart}>{item.plannedStart}</time>
          {' - '}
          <time dateTime={item.plannedEnd}>{item.plannedEnd}</time>
        </span>
        <span>
          {t('scheduling.actual')}{' '}
          {actualInterval === null ? t('scheduling.notStarted') : (
            <>
              <time dateTime={actualInterval.start}>{actualInterval.start}</time>
              {item.actualEnd === null ? (
                <>
                  {' '}
                  {t('scheduling.openThrough')}{' '}
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
          {lifecycleStatus.labelKey === null
            ? t('scheduling.unknownValue', { value: item.status })
            : t(lifecycleStatus.labelKey)}
        </span>
        <span className={`plan-actual-status ${actualInterval === null ? 'planned' : delayed ? 'delayed' : 'on-time'}`}>
          {statusLabel}
        </span>
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
  const { t } = useI18n()
  const resourceGroups = groupResourceOccupancies(items)

  if (resourceGroups.length === 0) {
    return <div role="status">{t('scheduling.noResourcePlanActualItems')}</div>
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
