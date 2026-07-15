import type { ReactNode } from 'react'
import type { SchedulePlanItemModel } from '../types'
import { formatScheduleDeviation } from '../lib/scheduling'

export interface ScheduleItemDetailsProps {
  item: SchedulePlanItemModel | null
  now: string
}

type DisplayContext = Record<string, unknown>

const STATUS_LABELS = [
  'Planned',
  'Waiting',
  'Running',
  'Completed',
  'Delayed',
  'Blocked',
  'Canceled',
] as const

function getStatusLabel(status: number): string {
  return STATUS_LABELS[status] ?? `Unknown (${status})`
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
  if (item === null) {
    return (
      <section
        aria-label="Schedule item details"
        className="schedule-item-details schedule-item-details-empty"
        role="status"
      >
        Select a schedule item
      </section>
    )
  }

  const context = parseDisplayContext(item.displayContextJson)
  const orderCode = displayValue(readContextValue(context, 'orderCode'))
  const order = orderCode !== '--'
    ? orderCode
    : displayValue(readContextValue(context, 'orderId'))
  const locationFields = [
    ['sourceLocation', 'Source location'],
    ['requestedSourceLocation', 'Requested source location'],
    ['targetLocation', 'Target location'],
    ['requestedTargetLocation', 'Requested target location'],
  ] as const

  return (
    <section aria-label="Schedule item details" className="schedule-item-details">
      <dl className="schedule-item-details-list">
        <Detail label="FlowTask">{item.flowTaskId}</Detail>
        <Detail label="OperationTask">{displayValue(item.operationTaskId)}</Detail>
        <Detail label="Order">{order}</Detail>
        <Detail label="Pallet">{displayValue(readContextValue(context, 'pallet'))}</Detail>
        <Detail label="SKU">{displayValue(readContextValue(context, 'sku'))}</Detail>
        <Detail label="Node">{displayValue(item.nodeId)}</Detail>
        <Detail label="Occurrence">{item.occurrence}</Detail>
        <Detail label="Resource">
          {displayValue(item.resourceType)} / {displayValue(item.resourceId)}
        </Detail>
        <Detail label="Status">{getStatusLabel(item.status)}</Detail>
        <Detail label="Planned">
          <time dateTime={item.plannedStart}>{item.plannedStart}</time>
          {' – '}
          <time dateTime={item.plannedEnd}>{item.plannedEnd}</time>
        </Detail>
        <Detail label="Actual">
          {item.actualStart === null ? '--' : (
            <>
              <time dateTime={item.actualStart}>{item.actualStart}</time>
              {item.actualEnd === null ? ' Open' : (
                <>
                  {' – '}
                  <time dateTime={item.actualEnd}>{item.actualEnd}</time>
                </>
              )}
            </>
          )}
        </Detail>
        <Detail label="Deviation">{formatItemDeviation(item, now)}</Detail>
        <Detail label="Delay reason">{displayValue(item.delayReason)}</Detail>
        <Detail label="Frozen">{item.isFrozen ? 'Yes' : 'No'}</Detail>
        {locationFields.map(([key, label]) => hasContextProperty(context, key) ? (
          <Detail key={key} label={label}>{displayValue(readContextValue(context, key))}</Detail>
        ) : null)}
      </dl>
    </section>
  )
}
