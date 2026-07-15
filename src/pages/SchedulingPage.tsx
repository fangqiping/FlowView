import { LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FlowScheduleTimeline } from '../components/FlowScheduleTimeline'
import { PageHeader } from '../components/PageHeader'
import { PlanActualTimeline } from '../components/PlanActualTimeline'
import { ResourceScheduleLanes } from '../components/ResourceScheduleLanes'
import { ScheduleItemDetails } from '../components/ScheduleItemDetails'
import { ScheduleVersionComparison } from '../components/ScheduleVersionComparison'
import { SchedulingSummary } from '../components/SchedulingSummary'
import { api } from '../lib/api'
import {
  getTimelineGeometry,
  groupResourceOccupancies,
  resolveActualInterval,
} from '../lib/scheduling'
import { useSchedulingWorkbench } from '../lib/useSchedulingWorkbench'
import type {
  SchedulePlanComparisonModel,
  SchedulePlanItemModel,
  SchedulePlanModel,
} from '../types'

type SchedulingView = 'resources' | 'flow' | 'actual' | 'versions'

const VIEW_OPTIONS: { id: SchedulingView; label: string }[] = [
  { id: 'resources', label: 'Resources' },
  { id: 'flow', label: 'Flow' },
  { id: 'actual', label: 'Plan vs actual' },
  { id: 'versions', label: 'Versions' },
]

function toError(caught: unknown): Error {
  return caught instanceof Error
    ? caught
    : new Error('Failed to load the schedule comparison.')
}

function visibleOccupancies(
  plan: SchedulePlanModel,
  now: string,
): SchedulePlanItemModel[] {
  return groupResourceOccupancies(plan.items).flatMap((lane) =>
    lane.items.filter((item) => {
      const actualInterval = item.actualStart === null
        ? null
        : resolveActualInterval(item, now, plan.horizonEnd)
      const interval = actualInterval ?? {
        start: item.plannedStart,
        end: item.plannedEnd,
      }
      return getTimelineGeometry(
        interval.start,
        interval.end,
        plan.horizonStart,
        plan.horizonEnd,
      ).widthPercent > 0
    }),
  )
}

interface ComparisonRequestProps {
  apiClient: Pick<typeof api, 'compareSchedulePlans'>
  currentPlan: SchedulePlanModel
  previousPlan: SchedulePlanModel | null
  previousPlanId: number
}

interface ComparisonRequestIdentity {
  apiClient: Pick<typeof api, 'compareSchedulePlans'>
  currentPlanId: number
  previousPlanId: number
}

interface ComparisonRequestState {
  request: ComparisonRequestIdentity
  comparison: SchedulePlanComparisonModel | null
  error: Error | null
}

function isCurrentComparisonRequest(
  request: ComparisonRequestIdentity,
  apiClient: Pick<typeof api, 'compareSchedulePlans'>,
  currentPlanId: number,
  previousPlanId: number,
): boolean {
  return request.apiClient === apiClient
    && request.currentPlanId === currentPlanId
    && request.previousPlanId === previousPlanId
}

function ComparisonRequest({
  apiClient,
  currentPlan,
  previousPlan,
  previousPlanId,
}: ComparisonRequestProps) {
  const [state, setState] = useState<ComparisonRequestState>(() => ({
    request: {
      apiClient,
      currentPlanId: currentPlan.id,
      previousPlanId,
    },
    comparison: null,
    error: null,
  }))
  const stateIsCurrent = isCurrentComparisonRequest(
    state.request,
    apiClient,
    currentPlan.id,
    previousPlanId,
  )
  const comparison = stateIsCurrent ? state.comparison : null
  const error = stateIsCurrent ? state.error : null
  const isLoading = !stateIsCurrent || (comparison === null && error === null)

  useEffect(() => {
    let active = true
    const request = {
      apiClient,
      currentPlanId: currentPlan.id,
      previousPlanId,
    }

    void apiClient.compareSchedulePlans(currentPlan.id, previousPlanId).then(
      (nextComparison) => {
        if (active) {
          setState({ request, comparison: nextComparison, error: null })
        }
      },
      (caught: unknown) => {
        if (active) {
          setState({ request, comparison: null, error: toError(caught) })
        }
      },
    )

    return () => {
      active = false
    }
  }, [apiClient, currentPlan.id, previousPlanId])

  return (
    <ScheduleVersionComparison
      comparison={comparison}
      currentPlan={currentPlan}
      error={error}
      isLoading={isLoading}
      previousPlan={previousPlan}
    />
  )
}

function VersionsView({
  apiClient,
  currentPlan,
  history,
  selectedPlanId,
  onSelectPlan,
}: {
  apiClient: Pick<typeof api, 'compareSchedulePlans'>
  currentPlan: SchedulePlanModel
  history: SchedulePlanModel[]
  selectedPlanId: number | null
  onSelectPlan(planId: number): void
}) {
  const plans = history.length > 0 ? history : [currentPlan]
  const defaultPlan = history.find((plan) => plan.id === currentPlan.id)
    ?? history[0]
    ?? currentPlan
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? defaultPlan
  const previousPlan = selectedPlan.previousPlanId === null
    ? null
    : history.find((plan) => plan.id === selectedPlan.previousPlanId)
      ?? (currentPlan.id === selectedPlan.previousPlanId ? currentPlan : null)
  const hasValidIds = Number.isSafeInteger(selectedPlan.id)
    && selectedPlan.id > 0
    && Number.isSafeInteger(selectedPlan.previousPlanId)
    && (selectedPlan.previousPlanId ?? 0) > 0

  return (
    <div className="scheduling-versions-view">
      <label className="scheduling-version-selector">
        <span>Schedule version</span>
        <select
          onChange={(event) => onSelectPlan(Number(event.target.value))}
          value={selectedPlan.id}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>v{plan.version}</option>
          ))}
        </select>
      </label>
      {hasValidIds && selectedPlan.previousPlanId !== null ? (
        <ComparisonRequest
          apiClient={apiClient}
          currentPlan={selectedPlan}
          key={`${selectedPlan.id}:${selectedPlan.previousPlanId}`}
          previousPlan={previousPlan}
          previousPlanId={selectedPlan.previousPlanId}
        />
      ) : (
        <ScheduleVersionComparison
          comparison={null}
          currentPlan={selectedPlan}
          previousPlan={previousPlan}
        />
      )}
    </div>
  )
}

export function SchedulingPage({
  apiOverride = api,
}: {
  apiOverride?: Pick<typeof api, 'compareSchedulePlans'>
}) {
  const {
    plan,
    history,
    error,
    lastUpdatedAt,
    isLoading,
    isReplanning,
    refresh,
    replan,
  } = useSchedulingWorkbench()
  const [view, setView] = useState<SchedulingView>('resources')
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const now = new Date().toISOString()
  const occupancies = plan === null ? [] : visibleOccupancies(plan, now)
  const selectedItem = occupancies.find((item) => item.id === selectedItemId)
    ?? occupancies[0]
    ?? null

  return (
    <div className="page scheduling-page">
      <PageHeader
        actions={
          <>
            <button
              aria-label="Refresh schedule"
              className="icon-button scheduling-refresh-button"
              disabled={isLoading}
              onClick={() => void refresh()}
              title="Refresh schedule"
              type="button"
            >
              {isLoading
                ? <LoaderCircle aria-hidden="true" size={18} />
                : <RefreshCw aria-hidden="true" size={18} />}
            </button>
            <button
              aria-busy={isReplanning}
              className="primary-button scheduling-replan-button"
              disabled={isReplanning}
              onClick={() => void replan()}
              type="button"
            >
              {isReplanning
                ? <LoaderCircle aria-hidden="true" size={16} />
                : <RefreshCw aria-hidden="true" size={16} />}
              <span>Replan now</span>
            </button>
          </>
        }
        eyebrow="Operations"
        title="Global scheduling"
      />

      {error !== null ? (
        <div className="banner error" role="alert">{error.message}</div>
      ) : null}

      {plan === null ? (
        <div className="scheduling-page-state" role="status">
          {isLoading ? 'Loading schedule workbench' : 'No current schedule plan'}
        </div>
      ) : (
        <>
          <SchedulingSummary
            isLoading={isLoading}
            lastUpdatedAt={lastUpdatedAt}
            plan={plan}
          />

          <div
            aria-label="Scheduling view"
            className="scheduling-view-switcher"
            role="group"
          >
            {VIEW_OPTIONS.map((option) => (
              <button
                aria-pressed={view === option.id}
                key={option.id}
                onClick={() => setView(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="scheduling-workbench">
            {view === 'resources' ? (
              <div className="scheduling-resource-workbench">
                <div className="scheduling-resource-timeline">
                  <ResourceScheduleLanes
                    horizonEnd={plan.horizonEnd}
                    horizonStart={plan.horizonStart}
                    items={plan.items}
                    now={now}
                    onSelect={(item) => setSelectedItemId(item.id)}
                    selectedItemId={selectedItem?.id ?? null}
                  />
                </div>
                <aside className="scheduling-item-inspector">
                  <ScheduleItemDetails item={selectedItem} now={now} />
                </aside>
              </div>
            ) : null}
            {view === 'flow' ? (
              <FlowScheduleTimeline
                horizonEnd={plan.horizonEnd}
                horizonStart={plan.horizonStart}
                items={plan.items}
                now={now}
              />
            ) : null}
            {view === 'actual' ? (
              <PlanActualTimeline
                horizonEnd={plan.horizonEnd}
                horizonStart={plan.horizonStart}
                items={plan.items}
                now={now}
              />
            ) : null}
            {view === 'versions' ? (
              <VersionsView
                apiClient={apiOverride}
                currentPlan={plan}
                history={history}
                onSelectPlan={setSelectedPlanId}
                selectedPlanId={selectedPlanId}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
