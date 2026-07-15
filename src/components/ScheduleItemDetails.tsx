import type { ReactNode } from 'react'
import type { SchedulePlanItemModel } from '../types'
import { formatScheduleDeviation } from '../lib/scheduling'
import type { MessageKey } from '../i18n/messages'
import { useI18n } from '../i18n/useI18n'

export interface ScheduleItemDetailsProps {
  item: SchedulePlanItemModel | null
  now: string
}

type DisplayContext = Record<string, unknown>

const STATUS_KEYS: MessageKey[] = [
  'scheduling.statusPlanned',
  'scheduling.statusWaiting',
  'scheduling.statusRunning',
  'scheduling.statusCompleted',
  'scheduling.statusDelayed',
  'scheduling.statusBlocked',
  'scheduling.statusCanceled',
] as const

function getStatusKey(status: number): MessageKey | null {
  return STATUS_KEYS[status] ?? null
}

function parseDisplayContext(value: string | null): DisplayContext {
  if (!value) return {}

  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as DisplayContext
      : {}
  } catch {
    return {}
  }
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value.trim() !== '') return value
  return '--'
}

function hasContextProperty(context: DisplayContext, key: string): boolean {
  return Object.hasOwn(context, key)
}

function readContextValue(context: DisplayContext, key: string): unknown {
  return hasContextProperty(context, key) ? context[key] : undefined
}

function formatItemDeviation(item: SchedulePlanItemModel, now: string): string {
  if (item.actualEnd !== null) {
    return formatScheduleDeviation(item.plannedEnd, item.actualEnd)
  }

  if (item.predictedEnd !== null) {
    const predictedDeviation = formatScheduleDeviation(item.plannedEnd, item.predictedEnd)
    if (predictedDeviation !== '--') return predictedDeviation
  }

  if (item.actualStart === null) return '--'

  const currentDeviation = formatScheduleDeviation(item.plannedEnd, now)
  return currentDeviation.startsWith('+') ? currentDeviation : '--'
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="schedule-item-detail">
      <dt className="schedule-item-detail-label">{label}</dt>
      <dd className="schedule-item-detail-value">{children}</dd>
    </div>
  )
}

export function ScheduleItemDetails({ item, now }: ScheduleItemDetailsProps) {
  const { t } = useI18n()

  if (item === null) {
    return (
      <section
        aria-label={t('scheduling.itemDetails')}
        className="schedule-item-details schedule-item-details-empty"
        role="status"
      >
        {t('scheduling.selectItem')}
      </section>
    )
  }

  const context = parseDisplayContext(item.displayContextJson)
  const orderCode = displayValue(readContextValue(context, 'orderCode'))
  const order = orderCode !== '--'
    ? orderCode
    : displayValue(readContextValue(context, 'orderId'))
  const locationFields = [
    ['sourceLocation', 'scheduling.sourceLocation'],
    ['requestedSourceLocation', 'scheduling.requestedSourceLocation'],
    ['targetLocation', 'scheduling.targetLocation'],
    ['requestedTargetLocation', 'scheduling.requestedTargetLocation'],
  ] as const
  const statusKey = getStatusKey(item.status)

  return (
    <section aria-label={t('scheduling.itemDetails')} className="schedule-item-details">
      <dl className="schedule-item-details-list">
        <Detail label={t('scheduling.flowTask')}>{item.flowTaskId}</Detail>
        <Detail label={t('scheduling.operationTask')}>{displayValue(item.operationTaskId)}</Detail>
        <Detail label={t('scheduling.order')}>{order}</Detail>
        <Detail label={t('scheduling.pallet')}>{displayValue(readContextValue(context, 'pallet'))}</Detail>
        <Detail label={t('scheduling.sku')}>{displayValue(readContextValue(context, 'sku'))}</Detail>
        <Detail label={t('scheduling.node')}>{displayValue(item.nodeId)}</Detail>
        <Detail label={t('scheduling.occurrence')}>{item.occurrence}</Detail>
        <Detail label={t('scheduling.resource')}>
          {displayValue(item.resourceType)} / {displayValue(item.resourceId)}
        </Detail>
        <Detail label={t('scheduling.status')}>
          {statusKey === null
            ? t('scheduling.unknownValue', { value: item.status })
            : t(statusKey)}
        </Detail>
        <Detail label={t('scheduling.planned')}>
          <time dateTime={item.plannedStart}>{item.plannedStart}</time>
          {' – '}
          <time dateTime={item.plannedEnd}>{item.plannedEnd}</time>
        </Detail>
        <Detail label={t('scheduling.actual')}>
          {item.actualStart === null ? '--' : (
            <>
              <time dateTime={item.actualStart}>{item.actualStart}</time>
              {item.actualEnd === null ? ` ${t('scheduling.open')}` : (
                <>
                  {' – '}
                  <time dateTime={item.actualEnd}>{item.actualEnd}</time>
                </>
              )}
            </>
          )}
        </Detail>
        <Detail label={t('scheduling.deviation')}>{formatItemDeviation(item, now)}</Detail>
        <Detail label={t('scheduling.delayReason')}>{displayValue(item.delayReason)}</Detail>
        <Detail label={t('scheduling.frozen')}>
          {item.isFrozen ? t('scheduling.yes') : t('scheduling.no')}
        </Detail>
        {locationFields.map(([key, label]) => hasContextProperty(context, key) ? (
          <Detail key={key} label={t(label)}>{displayValue(readContextValue(context, key))}</Detail>
        ) : null)}
      </dl>
    </section>
  )
}
