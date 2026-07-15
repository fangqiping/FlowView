import type { ReactNode } from 'react'
import type { SchedulePlanModel } from '../types'

export interface SchedulingSummaryProps {
  plan: SchedulePlanModel
  lastUpdatedAt: Date | null
  isLoading: boolean
}

const PLAN_STATUS_LABELS = ['Draft', 'Committed', 'Superseded', 'Failed'] as const
const SOLVER_STATUS_LABELS = [
  'Unknown',
  'Model invalid',
  'Feasible',
  'Infeasible',
  'Optimal',
] as const

function statusLabel(labels: readonly string[], status: number): string {
  return labels[status] ?? `Unknown (${status})`
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
    <section aria-label="Scheduling summary" className="scheduling-summary">
      <dl className="scheduling-summary-list">
        <SummaryEntry label="Plan version">v{plan.version}</SummaryEntry>
        <SummaryEntry label="Plan status">
          {statusLabel(PLAN_STATUS_LABELS, plan.status)}
        </SummaryEntry>
        <SummaryEntry label="Solver status">
          {statusLabel(SOLVER_STATUS_LABELS, plan.solverStatus)}
        </SummaryEntry>
        <SummaryEntry label="Horizon start">
          <Timestamp value={plan.horizonStart} />
        </SummaryEntry>
        <SummaryEntry label="Horizon end">
          <Timestamp value={plan.horizonEnd} />
        </SummaryEntry>
        <SummaryEntry label="Waiting">
          {nodeExecutions.filter((item) => item.status === 1).length}
        </SummaryEntry>
        <SummaryEntry label="Running">
          {nodeExecutions.filter((item) => item.status === 2).length}
        </SummaryEntry>
        <SummaryEntry label="Delayed">
          {nodeExecutions.filter((item) => item.status === 4).length}
        </SummaryEntry>
        <SummaryEntry label="Resource occupancies">{occupancies.length}</SummaryEntry>
        <SummaryEntry label="Distinct resources">{resourceKeys.size}</SummaryEntry>
        <SummaryEntry label="Open occupancies">{openOccupancies}</SummaryEntry>
        <SummaryEntry label="Expected completion">
          <Timestamp value={expectedCompletion} />
        </SummaryEntry>
        <SummaryEntry label="Last updated">
          <Timestamp value={lastUpdated} />
        </SummaryEntry>
      </dl>
      {isLoading ? (
        <div className="scheduling-summary-refreshing" role="status">
          Refreshing
        </div>
      ) : null}
    </section>
  )
}
