import type {
  SchedulePlanChangeModel,
  SchedulePlanComparisonModel,
  SchedulePlanItemModel,
  SchedulePlanModel,
  ScheduleSolveAttemptModel,
} from '../types'
import type { MessageKey } from '../i18n/messages'
import { useI18n } from '../i18n/useI18n'

export interface ScheduleVersionComparisonProps {
  comparison: SchedulePlanComparisonModel | null
  currentPlan: SchedulePlanModel | null
  previousPlan: SchedulePlanModel | null
  isLoading?: boolean
  error?: Error | null
}

const CHANGE_KIND_KEYS: MessageKey[] = [
  'scheduling.changeAdded',
  'scheduling.changeRemoved',
  'scheduling.changeChanged',
] as const

function getChangeKindKey(kind: number): MessageKey | null {
  return CHANGE_KIND_KEYS[kind] ?? null
}

function displayItemIdentity(
  item: SchedulePlanItemModel | null,
  formatIdentity: (params: Record<string, string | number>) => string,
): string {
  if (item === null) return '--'

  const resourceIdentity = item.resourceType !== null || item.resourceId !== null
    ? `${item.resourceType ?? '--'} / ${item.resourceId ?? '--'}`
    : '--'
  return formatIdentity({
    label: item.displayLabel,
    node: item.nodeId,
    resource: resourceIdentity,
  })
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
  const { t } = useI18n()

  return (
    <aside
      aria-label={t('scheduling.failedSolveAttempt')}
      className="schedule-solve-failure"
      role="alert"
    >
      <h3>{t('scheduling.failedSolveAttempt')}</h3>
      <dl>
        <div>
          <dt>{t('scheduling.failureReason')}</dt>
          <dd>{attempt.failureReason ?? '--'}</dd>
        </div>
        <div>
          <dt>{t('scheduling.candidateCount')}</dt>
          <dd>{attempt.candidateCount}</dd>
        </div>
        <div>
          <dt>{t('scheduling.started')}</dt>
          <dd><Timestamp value={attempt.startedAt} /></dd>
        </div>
        <div>
          <dt>{t('scheduling.finished')}</dt>
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
  const { t } = useI18n()
  const currentItem = findItem(currentPlan, change.currentItemId)
  const previousItem = findItem(previousPlan, change.previousItemId)
  const changeKindKey = getChangeKindKey(change.kind)
  const formatIdentity = (params: Record<string, string | number>) =>
    t('scheduling.comparisonItemIdentity', params)

  return (
    <li className="schedule-comparison-change">
      <h3>
        {changeKindKey === null
          ? t('scheduling.unknownValue', { value: change.kind })
          : t(changeKindKey)}
      </h3>
      <dl>
        <div>
          <dt>{t('scheduling.currentItem')}</dt>
          <dd>{displayItemIdentity(currentItem, formatIdentity)}</dd>
        </div>
        <div>
          <dt>{t('scheduling.previousItem')}</dt>
          <dd>{displayItemIdentity(previousItem, formatIdentity)}</dd>
        </div>
        <div>
          <dt>{t('scheduling.previousStart')}</dt>
          <dd><Timestamp value={change.previousStart} /></dd>
        </div>
        <div>
          <dt>{t('scheduling.currentStart')}</dt>
          <dd><Timestamp value={change.currentStart} /></dd>
        </div>
        <div>
          <dt>{t('scheduling.reason')}</dt>
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
  const { t } = useI18n()
  const matchedCurrentPlan = comparison !== null && currentPlan?.id === comparison.planId
    ? currentPlan
    : null
  const matchedPreviousPlan = comparison !== null && previousPlan?.id === comparison.previousPlanId
    ? previousPlan
    : null
  const heading = comparison === null
    ? t('scheduling.comparison')
    : matchedCurrentPlan !== null && matchedPreviousPlan !== null
      ? t('scheduling.comparisonVersions', {
          previousVersion: matchedPreviousPlan.version,
          currentVersion: matchedCurrentPlan.version,
        })
      : t('scheduling.comparisonPlans', {
          previousPlanId: comparison.previousPlanId,
          planId: comparison.planId,
        })
  const solveSummaryPlan = comparison === null ? currentPlan : matchedCurrentPlan
  const keyedChanges = comparison === null ? [] : addStableKeys(comparison.changes)

  return (
    <section aria-label={t('scheduling.versionComparison')} className="schedule-version-comparison">
      <h2>{heading}</h2>
      {isLoading ? <div role="status">{t('scheduling.loadingComparison')}</div> : null}
      {!isLoading && error !== null ? (
        <div role="alert">
          {t('scheduling.comparisonError', {
            message: error.message || t('scheduling.comparisonLoadFailure'),
          })}
        </div>
      ) : null}
      {solveSummaryPlan?.latestSolveAttempt?.status === 3 ? (
        <FailedSolveSummary attempt={solveSummaryPlan.latestSolveAttempt} />
      ) : null}
      {!isLoading && error === null && comparison === null ? (
        <div role="status">{t('scheduling.noComparison')}</div>
      ) : null}
      {!isLoading && error === null && comparison !== null && comparison.changes.length === 0 ? (
        <div role="status">{t('scheduling.noChanges')}</div>
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
