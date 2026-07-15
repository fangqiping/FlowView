import type {
  SchedulePlanChangeModel,
  SchedulePlanComparisonModel,
  SchedulePlanItemModel,
  SchedulePlanModel,
  ScheduleSolveAttemptModel,
} from '../types'

export interface ScheduleVersionComparisonProps {
  comparison: SchedulePlanComparisonModel | null
  currentPlan: SchedulePlanModel | null
  previousPlan: SchedulePlanModel | null
  isLoading?: boolean
  error?: Error | null
}

const CHANGE_KIND_LABELS = ['Added', 'Removed', 'Changed'] as const

function getChangeKindLabel(kind: number): string {
  return CHANGE_KIND_LABELS[kind] ?? `Unknown (${kind})`
}

function displayItemIdentity(item: SchedulePlanItemModel | null): string {
  if (item === null) return '--'

  const resourceIdentity = item.resourceType !== null || item.resourceId !== null
    ? `${item.resourceType ?? '--'} / ${item.resourceId ?? '--'}`
    : '--'
  return `${item.displayLabel}; node ${item.nodeId}; resource ${resourceIdentity}`
}

function findItem(plan: SchedulePlanModel | null, itemId: number | null): SchedulePlanItemModel | null {
  if (plan === null || itemId === null) return null
  return plan.items.find((item) => item.id === itemId) ?? null
}

function addStableKeys(changes: SchedulePlanChangeModel[]) {
  const duplicateCounts = new Map<string, number>()

  return changes.map((change) => {
    const baseKey = [
      change.kind,
      change.currentItemId ?? 'none',
      change.previousItemId ?? 'none',
    ].join(':')
    const duplicateCount = duplicateCounts.get(baseKey) ?? 0
    duplicateCounts.set(baseKey, duplicateCount + 1)

    return {
      change,
      key: duplicateCount === 0 ? baseKey : `${baseKey}:duplicate:${duplicateCount}`,
    }
  })
}

function Timestamp({ value }: { value: string | null }) {
  return value === null ? '--' : <time dateTime={value}>{value}</time>
}

function FailedSolveSummary({ attempt }: { attempt: ScheduleSolveAttemptModel }) {
  return (
    <aside aria-label="Failed solve attempt" className="schedule-solve-failure" role="alert">
      <h3>Failed solve attempt</h3>
      <dl>
        <div>
          <dt>Failure reason</dt>
          <dd>{attempt.failureReason ?? '--'}</dd>
        </div>
        <div>
          <dt>Candidate count</dt>
          <dd>{attempt.candidateCount}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd><Timestamp value={attempt.startedAt} /></dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd><Timestamp value={attempt.finishedAt} /></dd>
        </div>
      </dl>
    </aside>
  )
}

interface ChangeEntryProps {
  change: SchedulePlanChangeModel
  currentPlan: SchedulePlanModel | null
  previousPlan: SchedulePlanModel | null
}

function ChangeEntry({ change, currentPlan, previousPlan }: ChangeEntryProps) {
  const currentItem = findItem(currentPlan, change.currentItemId)
  const previousItem = findItem(previousPlan, change.previousItemId)

  return (
    <li className="schedule-comparison-change">
      <h3>{getChangeKindLabel(change.kind)}</h3>
      <dl>
        <div>
          <dt>Current item</dt>
          <dd>{displayItemIdentity(currentItem)}</dd>
        </div>
        <div>
          <dt>Previous item</dt>
          <dd>{displayItemIdentity(previousItem)}</dd>
        </div>
        <div>
          <dt>PreviousStart</dt>
          <dd><Timestamp value={change.previousStart} /></dd>
        </div>
        <div>
          <dt>CurrentStart</dt>
          <dd><Timestamp value={change.currentStart} /></dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd className="schedule-comparison-reason">{change.reason ?? '--'}</dd>
        </div>
      </dl>
    </li>
  )
}

export function ScheduleVersionComparison({
  comparison,
  currentPlan,
  previousPlan,
  isLoading = false,
  error = null,
}: ScheduleVersionComparisonProps) {
  const matchedCurrentPlan = comparison !== null && currentPlan?.id === comparison.planId
    ? currentPlan
    : null
  const matchedPreviousPlan = comparison !== null && previousPlan?.id === comparison.previousPlanId
    ? previousPlan
    : null
  const heading = comparison === null
    ? 'Schedule comparison'
    : matchedCurrentPlan !== null && matchedPreviousPlan !== null
      ? `Schedule comparison v${matchedPreviousPlan.version} -> v${matchedCurrentPlan.version}`
      : `Schedule comparison plan ${comparison.previousPlanId} -> plan ${comparison.planId}`
  const solveSummaryPlan = comparison === null ? currentPlan : matchedCurrentPlan
  const keyedChanges = comparison === null ? [] : addStableKeys(comparison.changes)

  return (
    <section aria-label="Schedule version comparison" className="schedule-version-comparison">
      <h2>{heading}</h2>
      {isLoading ? <div role="status">Loading schedule comparison</div> : null}
      {!isLoading && error !== null ? (
        <div role="alert">Schedule comparison error: {error.message}</div>
      ) : null}
      {solveSummaryPlan?.latestSolveAttempt?.status === 3 ? (
        <FailedSolveSummary attempt={solveSummaryPlan.latestSolveAttempt} />
      ) : null}
      {!isLoading && error === null && comparison === null ? (
        <div role="status">No schedule comparison available</div>
      ) : null}
      {!isLoading && error === null && comparison !== null && comparison.changes.length === 0 ? (
        <div role="status">No schedule changes</div>
      ) : null}
      {!isLoading && error === null && comparison !== null && comparison.changes.length > 0 ? (
        <ol className="schedule-comparison-changes">
          {keyedChanges.map(({ change, key }) => (
            <ChangeEntry
              change={change}
              currentPlan={matchedCurrentPlan}
              key={key}
              previousPlan={matchedPreviousPlan}
            />
          ))}
        </ol>
      ) : null}
    </section>
  )
}
