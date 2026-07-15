import type { ReactNode } from 'react'
import type { SchedulePlanModel } from '../types'
import type { MessageKey } from '../i18n/messages'
import { useI18n } from '../i18n/useI18n'

export interface SchedulingSummaryProps {
  plan: SchedulePlanModel
  lastUpdatedAt: Date | null
  isLoading: boolean
}

const PLAN_STATUS_KEYS: MessageKey[] = [
  'scheduling.planDraft',
  'scheduling.planCommitted',
  'scheduling.planSuperseded',
  'scheduling.planFailed',
] as const
const SOLVER_STATUS_KEYS: MessageKey[] = [
  'scheduling.solverUnknown',
  'scheduling.solverModelInvalid',
  'scheduling.solverFeasible',
  'scheduling.solverInfeasible',
  'scheduling.solverOptimal',
] as const

function statusKey(keys: readonly MessageKey[], status: number): MessageKey | null {
  return keys[status] ?? null
}

function latestExpectedCompletion(plan: SchedulePlanModel): string | null {
  let latest: { value: string; timestamp: number } | null = null

  for (const item of plan.items) {
    const predictedEnd = item.predictedEnd
    const predictedTimestamp = predictedEnd === null ? Number.NaN : Date.parse(predictedEnd)
    const value: string = predictedEnd !== null && Number.isFinite(predictedTimestamp)
      ? predictedEnd
      : item.plannedEnd
    const timestamp = Date.parse(value)

    if (Number.isFinite(timestamp) && (latest === null || timestamp > latest.timestamp)) {
      latest = { value, timestamp }
    }
  }

  return latest?.value ?? null
}

function SummaryEntry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="scheduling-summary-item">
      <dt className="scheduling-summary-label">{label}</dt>
      <dd className="scheduling-summary-value">{children}</dd>
    </div>
  )
}

function Timestamp({ value }: { value: string | null }) {
  return value === null ? '--' : <time dateTime={value}>{value}</time>
}

export function SchedulingSummary({
  plan,
  lastUpdatedAt,
  isLoading,
}: SchedulingSummaryProps) {
  const { t } = useI18n()
  const nodeExecutions = plan.items.filter((item) => item.itemKind === 0)
  const occupancies = plan.items.filter((item) => item.itemKind === 1)
  const resourceKeys = new Set(
    occupancies.flatMap((item) =>
      item.resourceType !== null && item.resourceId !== null
        ? [`${item.resourceType}\u0000${item.resourceId}`]
        : [],
    ),
  )
  const openOccupancies = occupancies.filter(
    (item) => item.actualStart !== null && item.actualEnd === null,
  ).length
  const expectedCompletion = latestExpectedCompletion(plan)
  const lastUpdated = lastUpdatedAt?.toISOString() ?? null

  return (
    <section aria-label={t('scheduling.summary')} className="scheduling-summary">
      <dl className="scheduling-summary-list">
        <SummaryEntry label={t('scheduling.planVersion')}>v{plan.version}</SummaryEntry>
        <SummaryEntry label={t('scheduling.planStatus')}>
          {statusKey(PLAN_STATUS_KEYS, plan.status) === null
            ? t('scheduling.unknownValue', { value: plan.status })
            : t(statusKey(PLAN_STATUS_KEYS, plan.status)!)}
        </SummaryEntry>
        <SummaryEntry label={t('scheduling.solverStatus')}>
          {statusKey(SOLVER_STATUS_KEYS, plan.solverStatus) === null
            ? t('scheduling.unknownValue', { value: plan.solverStatus })
            : t(statusKey(SOLVER_STATUS_KEYS, plan.solverStatus)!)}
        </SummaryEntry>
        <SummaryEntry label={t('scheduling.horizonStart')}>
          <Timestamp value={plan.horizonStart} />
        </SummaryEntry>
        <SummaryEntry label={t('scheduling.horizonEnd')}>
          <Timestamp value={plan.horizonEnd} />
        </SummaryEntry>
        <SummaryEntry label={t('scheduling.waiting')}>
          {nodeExecutions.filter((item) => item.status === 1).length}
        </SummaryEntry>
        <SummaryEntry label={t('scheduling.running')}>
          {nodeExecutions.filter((item) => item.status === 2).length}
        </SummaryEntry>
        <SummaryEntry label={t('scheduling.delayed')}>
          {nodeExecutions.filter((item) => item.status === 4).length}
        </SummaryEntry>
        <SummaryEntry label={t('scheduling.resourceOccupancies')}>{occupancies.length}</SummaryEntry>
        <SummaryEntry label={t('scheduling.distinctResources')}>{resourceKeys.size}</SummaryEntry>
        <SummaryEntry label={t('scheduling.openOccupancies')}>{openOccupancies}</SummaryEntry>
        <SummaryEntry label={t('scheduling.expectedCompletion')}>
          <Timestamp value={expectedCompletion} />
        </SummaryEntry>
        <SummaryEntry label={t('scheduling.lastUpdated')}>
          <Timestamp value={lastUpdated} />
        </SummaryEntry>
      </dl>
      {isLoading ? (
        <div className="scheduling-summary-refreshing" role="status">
          {t('scheduling.refreshing')}
        </div>
      ) : null}
    </section>
  )
}
