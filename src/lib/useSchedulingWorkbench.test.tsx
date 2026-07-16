import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SchedulePlanModel, ScheduleSolveAttemptModel } from '../types'
import { ApiError } from './api'
import {
  useSchedulingWorkbench,
  type SchedulingWorkbenchApi,
} from './useSchedulingWorkbench'

function createAttempt(
  overrides: Partial<ScheduleSolveAttemptModel> = {},
): ScheduleSolveAttemptModel {
  return {
    id: 50,
    previousPlanId: 17,
    trigger: 1,
    triggerDetail: 'Manual replan',
    startedAt: '2026-07-15T10:00:00Z',
    finishedAt: null,
    status: 0,
    solverStatus: 0,
    failureReason: null,
    candidateCount: 4,
    ...overrides,
  }
}

function createPlan(overrides: Partial<SchedulePlanModel> = {}): SchedulePlanModel {
  return {
    id: 18,
    version: 18,
    previousPlanId: 17,
    status: 1,
    solverStatus: 1,
    trigger: 1,
    triggerDetail: 'Initial plan',
    horizonStart: '2026-07-15T10:00:00Z',
    horizonEnd: '2026-07-15T11:00:00Z',
    createdAt: '2026-07-15T10:00:00Z',
    committedAt: '2026-07-15T10:00:01Z',
    makespan: 'PT1H',
    items: [],
    latestSolveAttempt: null,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, reject, resolve }
}

function createApiClient() {
  const getCurrentSchedulePlan = vi.fn<() => Promise<SchedulePlanModel>>()
  const getSchedulePlanHistory = vi.fn<() => Promise<SchedulePlanModel[]>>()
  const requestScheduleReplan = vi.fn<() => Promise<ScheduleSolveAttemptModel>>()
  const apiClient: SchedulingWorkbenchApi = {
    getCurrentSchedulePlan,
    getSchedulePlanHistory,
    requestScheduleReplan,
  }

  return {
    apiClient,
    getCurrentSchedulePlan,
    getSchedulePlanHistory,
    requestScheduleReplan,
  }
}

function renderWorkbench(
  apiClient: SchedulingWorkbenchApi,
  pollIntervalMs = 60_000,
  replanTimeoutMs = 120_000,
) {
  return renderHook(() =>
    useSchedulingWorkbench({
      apiClient,
      pollIntervalMs,
      replanTimeoutMs,
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSchedulingWorkbench', () => {
  it('loads the current plan and history concurrently on mount', async () => {
    const current = deferred<SchedulePlanModel>()
    const history = deferred<SchedulePlanModel[]>()
    const plan = createPlan()
    const previous = createPlan({ id: 17, version: 17 })
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory } =
      createApiClient()
    getCurrentSchedulePlan.mockReturnValue(current.promise)
    getSchedulePlanHistory.mockReturnValue(history.promise)

    const { result } = renderWorkbench(apiClient)

    expect(result.current.isLoading).toBe(true)
    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(1)
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(1)

    history.resolve([previous])
    await Promise.resolve()
    expect(result.current.isLoading).toBe(true)

    current.resolve(plan)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.plan).toEqual(plan)
    expect(result.current.history).toEqual([previous])
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date)
    expect(result.current.error).toBeNull()
  })

  it('treats a current-plan 404 as a successful no-plan refresh', async () => {
    const previous = createPlan({ id: 17, version: 17 })
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory } =
      createApiClient()
    getCurrentSchedulePlan.mockRejectedValue(new ApiError('Not found', 404, null))
    getSchedulePlanHistory.mockResolvedValue([previous])

    const { result } = renderWorkbench(apiClient)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.plan).toBeNull()
    expect(result.current.history).toEqual([previous])
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date)
    expect(result.current.error).toBeNull()
  })

  it('polls with one interval and clears it on unmount', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory } =
      createApiClient()
    getCurrentSchedulePlan.mockResolvedValue(createPlan())
    getSchedulePlanHistory.mockResolvedValue([])

    const { unmount } = renderWorkbench(apiClient, 20)

    await waitFor(() =>
      expect(getCurrentSchedulePlan.mock.calls.length).toBeGreaterThanOrEqual(2),
    )
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(
      getCurrentSchedulePlan.mock.calls.length,
    )
    const pollingCallIndexes = setIntervalSpy.mock.calls.flatMap((call, index) =>
      call[1] === 20 ? [index] : [],
    )
    expect(pollingCallIndexes).toHaveLength(1)
    const intervalId = setIntervalSpy.mock.results[pollingCallIndexes[0]].value

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId)
  })

  it('does not refresh through a retained callback after unmount', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory } =
      createApiClient()
    getCurrentSchedulePlan.mockResolvedValue(createPlan())
    getSchedulePlanHistory.mockResolvedValue([])

    const { result, unmount } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const retainedRefresh = result.current.refresh

    unmount()
    await retainedRefresh()

    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(1)
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('starts fresh requests for a new api client and ignores the old client results', async () => {
    const oldCurrent = deferred<SchedulePlanModel>()
    const oldHistory = deferred<SchedulePlanModel[]>()
    const oldPlan = createPlan({ id: 18, version: 18 })
    const nextPlan = createPlan({ id: 28, version: 28 })
    const nextHistory = [createPlan({ id: 27, version: 27 })]
    const oldApi = createApiClient()
    const nextApi = createApiClient()
    oldApi.getCurrentSchedulePlan.mockReturnValue(oldCurrent.promise)
    oldApi.getSchedulePlanHistory.mockReturnValue(oldHistory.promise)
    nextApi.getCurrentSchedulePlan.mockResolvedValue(nextPlan)
    nextApi.getSchedulePlanHistory.mockResolvedValue(nextHistory)

    const { result, rerender } = renderHook(
      ({ apiClient }) =>
        useSchedulingWorkbench({ apiClient, pollIntervalMs: 60_000 }),
      { initialProps: { apiClient: oldApi.apiClient } },
    )
    expect(oldApi.getCurrentSchedulePlan).toHaveBeenCalledTimes(1)
    expect(oldApi.getSchedulePlanHistory).toHaveBeenCalledTimes(1)

    rerender({ apiClient: nextApi.apiClient })

    await waitFor(() => expect(nextApi.getCurrentSchedulePlan).toHaveBeenCalledTimes(1))
    expect(nextApi.getSchedulePlanHistory).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.plan).toEqual(nextPlan))
    expect(result.current.history).toEqual(nextHistory)

    oldCurrent.resolve(oldPlan)
    oldHistory.resolve([oldPlan])
    await act(async () => {
      await Promise.all([oldCurrent.promise, oldHistory.promise])
      await Promise.resolve()
    })

    expect(result.current.plan).toEqual(nextPlan)
    expect(result.current.history).toEqual(nextHistory)
    expect(result.current.error).toBeNull()
  })

  it('uses the current api client through callbacks retained across a client change', async () => {
    const oldPlan = createPlan({ id: 18, version: 18 })
    const nextPlan = createPlan({ id: 28, version: 28 })
    const refreshedNextPlan = createPlan({ id: 29, version: 29 })
    const pendingNextPlan = createPlan({
      id: 30,
      version: 30,
      latestSolveAttempt: createAttempt({ id: 88, status: 0 }),
    })
    const oldApi = createApiClient()
    const nextApi = createApiClient()
    oldApi.getCurrentSchedulePlan.mockResolvedValue(oldPlan)
    oldApi.getSchedulePlanHistory.mockResolvedValue([oldPlan])
    oldApi.requestScheduleReplan.mockResolvedValue(createAttempt({ id: 77 }))
    nextApi.getCurrentSchedulePlan
      .mockResolvedValueOnce(nextPlan)
      .mockResolvedValueOnce(refreshedNextPlan)
      .mockResolvedValue(pendingNextPlan)
    nextApi.getSchedulePlanHistory.mockResolvedValue([nextPlan])
    nextApi.requestScheduleReplan.mockResolvedValue(createAttempt({ id: 88 }))

    const { result, rerender } = renderHook(
      ({ apiClient }) =>
        useSchedulingWorkbench({ apiClient, pollIntervalMs: 60_000 }),
      { initialProps: { apiClient: oldApi.apiClient } },
    )
    await waitFor(() => expect(result.current.plan).toEqual(oldPlan))
    const retainedRefresh = result.current.refresh
    const retainedReplan = result.current.replan

    rerender({ apiClient: nextApi.apiClient })
    await waitFor(() => expect(result.current.plan).toEqual(nextPlan))

    await act(async () => {
      await retainedRefresh()
      await retainedReplan()
    })

    expect(oldApi.getCurrentSchedulePlan).toHaveBeenCalledTimes(1)
    expect(oldApi.getSchedulePlanHistory).toHaveBeenCalledTimes(1)
    expect(oldApi.requestScheduleReplan).not.toHaveBeenCalled()
    expect(nextApi.getCurrentSchedulePlan).toHaveBeenCalledTimes(3)
    expect(nextApi.getSchedulePlanHistory).toHaveBeenCalledTimes(3)
    expect(nextApi.requestScheduleReplan).toHaveBeenCalledTimes(1)
    expect(result.current.plan).toEqual(pendingNextPlan)
    expect(result.current.error).toBeNull()
    expect(result.current.isReplanning).toBe(true)
  })

  it('isolates replan work when the api client changes', async () => {
    const oldPost = deferred<ScheduleSolveAttemptModel>()
    const nextPost = deferred<ScheduleSolveAttemptModel>()
    const oldPlan = createPlan({ id: 18, version: 18 })
    const nextPlan = createPlan({ id: 28, version: 28 })
    const nextPendingPlan = createPlan({
      id: 29,
      version: 29,
      latestSolveAttempt: createAttempt({ id: 88, status: 0 }),
    })
    const oldApi = createApiClient()
    const nextApi = createApiClient()
    oldApi.getCurrentSchedulePlan.mockResolvedValue(oldPlan)
    oldApi.getSchedulePlanHistory.mockResolvedValue([oldPlan])
    oldApi.requestScheduleReplan.mockReturnValue(oldPost.promise)
    nextApi.getCurrentSchedulePlan
      .mockResolvedValueOnce(nextPlan)
      .mockResolvedValue(nextPendingPlan)
    nextApi.getSchedulePlanHistory.mockResolvedValue([nextPlan])
    nextApi.requestScheduleReplan.mockReturnValue(nextPost.promise)

    const { result, rerender } = renderHook(
      ({ apiClient }) =>
        useSchedulingWorkbench({ apiClient, pollIntervalMs: 60_000 }),
      { initialProps: { apiClient: oldApi.apiClient } },
    )
    await waitFor(() => expect(result.current.plan).toEqual(oldPlan))

    let oldReplan!: Promise<void>
    act(() => {
      oldReplan = result.current.replan()
    })
    await waitFor(() => expect(result.current.isReplanning).toBe(true))

    rerender({ apiClient: nextApi.apiClient })
    await waitFor(() => expect(result.current.plan).toEqual(nextPlan))
    await waitFor(() => expect(result.current.isReplanning).toBe(false))

    let nextReplan!: Promise<void>
    act(() => {
      nextReplan = result.current.replan()
    })
    expect(nextApi.requestScheduleReplan).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.isReplanning).toBe(true))

    oldPost.reject(new Error('Old replan failed'))
    await act(async () => {
      await oldReplan
    })
    expect(result.current.plan).toEqual(nextPlan)
    expect(result.current.error).toBeNull()
    expect(result.current.isReplanning).toBe(true)
    expect(oldApi.getCurrentSchedulePlan).toHaveBeenCalledTimes(1)

    nextPost.resolve(createAttempt({ id: 88 }))
    await act(async () => {
      await nextReplan
    })
    expect(result.current.plan).toEqual(nextPendingPlan)
    expect(result.current.error).toBeNull()
    expect(result.current.isReplanning).toBe(true)
  })

  it('replaces only the interval when polling changes during a pending replan', async () => {
    const initialPlan = createPlan({ id: 18, version: 18 })
    const pendingPlan = createPlan({
      id: 19,
      version: 19,
      latestSolveAttempt: createAttempt({ id: 77, status: 0 }),
    })
    const terminalPlan = createPlan({
      id: 20,
      version: 20,
      latestSolveAttempt: createAttempt({ id: 77, status: 2 }),
    })
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const apiClient = createApiClient()
    apiClient.getCurrentSchedulePlan
      .mockResolvedValueOnce(initialPlan)
      .mockResolvedValueOnce(pendingPlan)
      .mockResolvedValue(terminalPlan)
    apiClient.getSchedulePlanHistory.mockResolvedValue([])
    apiClient.requestScheduleReplan.mockResolvedValue(createAttempt({ id: 77 }))

    const { result, rerender, unmount } = renderHook(
      ({ pollIntervalMs }) =>
        useSchedulingWorkbench({
          apiClient: apiClient.apiClient,
          pollIntervalMs,
      }),
      { initialProps: { pollIntervalMs: 60_000 } },
    )
    await waitFor(() => expect(result.current.plan).toEqual(initialPlan))

    await act(async () => {
      await result.current.replan()
    })
    expect(result.current.plan).toEqual(pendingPlan)
    expect(result.current.isReplanning).toBe(true)
    expect(apiClient.requestScheduleReplan).toHaveBeenCalledTimes(1)
    expect(apiClient.getCurrentSchedulePlan).toHaveBeenCalledTimes(2)

    const firstIntervalIndex = setIntervalSpy.mock.calls.findIndex(
      (call) => call[1] === 60_000,
    )
    const firstIntervalId = setIntervalSpy.mock.results[firstIntervalIndex].value
    rerender({ pollIntervalMs: 30_000 })

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.isReplanning).toBe(true)
    expect(apiClient.requestScheduleReplan).toHaveBeenCalledTimes(1)
    expect(apiClient.getSchedulePlanHistory).toHaveBeenCalledTimes(2)
    expect(apiClient.getCurrentSchedulePlan).toHaveBeenCalledTimes(2)
    expect(clearIntervalSpy).toHaveBeenCalledWith(firstIntervalId)
    const nextIntervalIndexes = setIntervalSpy.mock.calls.flatMap((call, index) =>
      call[1] === 30_000 ? [index] : [],
    )
    expect(nextIntervalIndexes).toHaveLength(1)
    const nextIntervalId = setIntervalSpy.mock.results[nextIntervalIndexes[0]].value

    await act(async () => {
      await result.current.replan()
    })
    expect(apiClient.requestScheduleReplan).toHaveBeenCalledTimes(1)
    expect(apiClient.getCurrentSchedulePlan).toHaveBeenCalledTimes(2)

    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.plan).toEqual(terminalPlan)
    expect(result.current.isReplanning).toBe(false)

    unmount()
    expect(clearIntervalSpy).toHaveBeenCalledWith(nextIntervalId)
  })

  it('shares an in-flight refresh without starting duplicate GET requests', async () => {
    const current = deferred<SchedulePlanModel>()
    const history = deferred<SchedulePlanModel[]>()
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory } =
      createApiClient()
    getCurrentSchedulePlan.mockReturnValue(current.promise)
    getSchedulePlanHistory.mockReturnValue(history.promise)

    const { result } = renderWorkbench(apiClient)
    let firstRefresh!: Promise<void>
    let secondRefresh!: Promise<void>

    act(() => {
      firstRefresh = result.current.refresh()
      secondRefresh = result.current.refresh()
    })

    expect(firstRefresh).toBe(secondRefresh)
    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(1)
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(1)

    current.resolve(createPlan())
    history.resolve([])
    await act(async () => {
      await Promise.all([firstRefresh, secondRefresh])
    })
  })

  it('keeps sharing a failed refresh until both GET requests settle', async () => {
    const current = deferred<SchedulePlanModel>()
    const history = deferred<SchedulePlanModel[]>()
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory } =
      createApiClient()
    getCurrentSchedulePlan
      .mockReturnValueOnce(current.promise)
      .mockResolvedValueOnce(createPlan())
    getSchedulePlanHistory
      .mockReturnValueOnce(history.promise)
      .mockResolvedValueOnce([])

    const { result } = renderWorkbench(apiClient)
    await waitFor(() => expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(1))

    await act(async () => {
      current.reject(new Error('Current unavailable'))
      await Promise.resolve()
    })

    let sharedRefresh!: Promise<void>
    act(() => {
      sharedRefresh = result.current.refresh()
    })
    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(1)
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(1)

    history.resolve([])
    await act(async () => {
      await sharedRefresh
    })

    await act(async () => {
      await result.current.refresh()
    })
    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(2)
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(2)
  })

  it('retains successful data on failure and replaces it on a later success', async () => {
    const firstPlan = createPlan()
    const firstHistory = [createPlan({ id: 17, version: 17 })]
    const nextPlan = createPlan({ id: 19, version: 19 })
    const nextHistory = [firstPlan, ...firstHistory]
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory } =
      createApiClient()
    getCurrentSchedulePlan.mockResolvedValueOnce(firstPlan)
    getSchedulePlanHistory.mockResolvedValueOnce(firstHistory)

    const { result } = renderWorkbench(apiClient)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const firstUpdatedAt = result.current.lastUpdatedAt

    getCurrentSchedulePlan.mockRejectedValueOnce(new Error('Current unavailable'))
    getSchedulePlanHistory.mockResolvedValueOnce(nextHistory)
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.plan).toEqual(firstPlan)
    expect(result.current.history).toEqual(firstHistory)
    expect(result.current.lastUpdatedAt).toBe(firstUpdatedAt)
    expect(result.current.error).toEqual(expect.any(Error))

    getCurrentSchedulePlan.mockResolvedValueOnce(nextPlan)
    getSchedulePlanHistory.mockResolvedValueOnce(nextHistory)
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.plan).toEqual(nextPlan)
    expect(result.current.history).toEqual(nextHistory)
    expect(result.current.lastUpdatedAt).not.toBe(firstUpdatedAt)
    expect(result.current.error).toBeNull()
  })

  it('leaves unknown failure messages empty for localized presentation', async () => {
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory } = createApiClient()
    getCurrentSchedulePlan.mockRejectedValue('network unavailable')
    getSchedulePlanHistory.mockResolvedValue([])

    const { result } = renderWorkbench(apiClient)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toEqual(expect.any(Error))
    expect(result.current.error?.message).toBe('')
  })

  it('shares one POST and its follow-up refresh across duplicate replan calls', async () => {
    const post = deferred<ScheduleSolveAttemptModel>()
    const attempt = createAttempt()
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan.mockResolvedValue(createPlan())
    getSchedulePlanHistory.mockResolvedValue([])
    requestScheduleReplan.mockReturnValue(post.promise)

    const { result } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    let firstReplan!: Promise<void>
    let secondReplan!: Promise<void>

    act(() => {
      firstReplan = result.current.replan()
      secondReplan = result.current.replan()
    })

    expect(firstReplan).toBe(secondReplan)
    expect(requestScheduleReplan).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.isReplanning).toBe(true))

    post.resolve(attempt)
    await act(async () => {
      await Promise.all([firstReplan, secondReplan])
    })

    expect(requestScheduleReplan).toHaveBeenCalledTimes(1)
    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(2)
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(2)
    expect(result.current.isReplanning).toBe(true)
  })

  it('does not replan again while the submitted attempt is non-terminal', async () => {
    const submittedAttempt = createAttempt({ id: 77 })
    const matchingPendingPlan = createPlan({
      latestSolveAttempt: createAttempt({ id: 77, status: 0 }),
    })
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan
      .mockResolvedValueOnce(createPlan())
      .mockResolvedValue(matchingPendingPlan)
    getSchedulePlanHistory.mockResolvedValue([])
    requestScheduleReplan.mockResolvedValue(submittedAttempt)

    const { result } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.replan()
    })
    expect(result.current.isReplanning).toBe(true)
    expect(requestScheduleReplan).toHaveBeenCalledTimes(1)
    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(2)
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(2)

    await act(async () => {
      await result.current.replan()
    })

    expect(requestScheduleReplan).toHaveBeenCalledTimes(1)
    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(2)
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(2)
  })

  it('starts a fresh GET pair after POST and any older refresh complete', async () => {
    const oldCurrent = deferred<SchedulePlanModel>()
    const oldHistory = deferred<SchedulePlanModel[]>()
    const postRefreshCurrent = deferred<SchedulePlanModel>()
    const postRefreshHistory = deferred<SchedulePlanModel[]>()
    const submittedAttempt = createAttempt({ id: 77 })
    const matchingTerminalPlan = createPlan({
      id: 19,
      version: 19,
      latestSolveAttempt: createAttempt({ id: 77, status: 2 }),
    })
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan
      .mockResolvedValueOnce(createPlan())
      .mockReturnValueOnce(oldCurrent.promise)
      .mockReturnValueOnce(postRefreshCurrent.promise)
    getSchedulePlanHistory
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(oldHistory.promise)
      .mockReturnValueOnce(postRefreshHistory.promise)
    requestScheduleReplan.mockResolvedValue(submittedAttempt)

    const { result } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let olderRefresh!: Promise<void>
    act(() => {
      olderRefresh = result.current.refresh()
    })
    await waitFor(() => expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(2))

    let replanWork!: Promise<void>
    act(() => {
      replanWork = result.current.replan()
    })
    await waitFor(() => expect(requestScheduleReplan).toHaveBeenCalledTimes(1))
    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(2)

    oldCurrent.resolve(matchingTerminalPlan)
    oldHistory.resolve([matchingTerminalPlan])
    await act(async () => {
      await olderRefresh
    })

    expect(result.current.isReplanning).toBe(true)
    await waitFor(() => expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(3))
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(3)

    postRefreshCurrent.resolve(matchingTerminalPlan)
    postRefreshHistory.resolve([matchingTerminalPlan])
    await act(async () => {
      await replanWork
    })

    expect(result.current.isReplanning).toBe(false)
  })

  it('keeps replanning for other or non-terminal attempts', async () => {
    const submittedAttempt = createAttempt({ id: 77 })
    const otherTerminalPlan = createPlan({
      latestSolveAttempt: createAttempt({ id: 76, status: 2 }),
    })
    const matchingPendingPlan = createPlan({
      latestSolveAttempt: createAttempt({ id: 77, status: 0 }),
    })
    const matchingRunningPlan = createPlan({
      latestSolveAttempt: createAttempt({ id: 77, status: 1 }),
    })
    const matchingFeasiblePlan = createPlan({
      latestSolveAttempt: createAttempt({ id: 77, status: 2 }),
    })
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan
      .mockResolvedValueOnce(createPlan())
      .mockResolvedValueOnce(otherTerminalPlan)
      .mockResolvedValueOnce(matchingPendingPlan)
      .mockResolvedValueOnce(matchingRunningPlan)
      .mockResolvedValueOnce(matchingFeasiblePlan)
    getSchedulePlanHistory.mockResolvedValue([])
    requestScheduleReplan.mockResolvedValue(submittedAttempt)

    const { result } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.replan()
    })
    expect(result.current.isReplanning).toBe(true)

    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.isReplanning).toBe(true)

    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.isReplanning).toBe(true)

    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.isReplanning).toBe(false)
  })

  it('clears replanning only after a newer superseding attempt becomes terminal', async () => {
    const submittedAttempt = createAttempt({ id: 77 })
    const newerPendingPlan = createPlan({
      latestSolveAttempt: createAttempt({ id: 78, status: 0 }),
    })
    const newerTerminalPlan = createPlan({
      latestSolveAttempt: createAttempt({ id: 78, status: 2 }),
    })
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan
      .mockResolvedValueOnce(createPlan())
      .mockResolvedValueOnce(newerPendingPlan)
      .mockResolvedValueOnce(newerTerminalPlan)
    getSchedulePlanHistory.mockResolvedValue([])
    requestScheduleReplan.mockResolvedValue(submittedAttempt)

    const { result } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.replan()
    })

    expect(result.current.isReplanning).toBe(true)
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.isReplanning).toBe(false)
    await act(async () => {
      await result.current.replan()
    })
    expect(requestScheduleReplan).toHaveBeenCalledTimes(2)
  })

  it('releases replanning after a bounded wait when no current plan exposes the attempt', async () => {
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan.mockRejectedValue(new ApiError('Not found', 404, null))
    getSchedulePlanHistory.mockResolvedValue([])
    requestScheduleReplan.mockResolvedValue(createAttempt({ id: 77 }))

    const { result } = renderWorkbench(apiClient, 60_000, 10)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.replan()
    })
    expect(result.current.isReplanning).toBe(true)

    await waitFor(() => expect(result.current.isReplanning).toBe(false))
    await act(async () => {
      await result.current.replan()
    })
    expect(requestScheduleReplan).toHaveBeenCalledTimes(2)
  })

  it('clears replanning when the submitted attempt fails and permits retry', async () => {
    const submittedAttempt = createAttempt({ id: 77 })
    const matchingFailedPlan = createPlan({
      latestSolveAttempt: createAttempt({ id: 77, status: 3 }),
    })
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan
      .mockResolvedValueOnce(createPlan())
      .mockResolvedValue(matchingFailedPlan)
    getSchedulePlanHistory.mockResolvedValue([])
    requestScheduleReplan.mockResolvedValue(submittedAttempt)

    const { result } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.replan()
    })

    expect(result.current.isReplanning).toBe(false)

    await act(async () => {
      await result.current.replan()
    })

    expect(requestScheduleReplan).toHaveBeenCalledTimes(2)
    expect(result.current.isReplanning).toBe(false)
  })

  it('surfaces a failed POST, clears busy state, and allows retry', async () => {
    const submittedAttempt = createAttempt({ id: 77 })
    const matchingTerminalPlan = createPlan({
      latestSolveAttempt: createAttempt({ id: 77, status: 2 }),
    })
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan
      .mockResolvedValueOnce(createPlan())
      .mockResolvedValueOnce(matchingTerminalPlan)
    getSchedulePlanHistory.mockResolvedValue([])
    requestScheduleReplan
      .mockRejectedValueOnce(new Error('Replan unavailable'))
      .mockResolvedValueOnce(submittedAttempt)

    const { result } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.replan()
    })

    expect(result.current.error).toEqual(expect.any(Error))
    expect(result.current.isReplanning).toBe(false)

    await act(async () => {
      await result.current.replan()
    })

    expect(requestScheduleReplan).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
    expect(result.current.isReplanning).toBe(false)
  })

  it('retains data and busy state when refresh fails while awaiting the attempt', async () => {
    const initialPlan = createPlan()
    const initialHistory = [createPlan({ id: 17, version: 17 })]
    const submittedAttempt = createAttempt({ id: 77 })
    const matchingTerminalPlan = createPlan({
      id: 19,
      version: 19,
      latestSolveAttempt: createAttempt({ id: 77, status: 2 }),
    })
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan
      .mockResolvedValueOnce(initialPlan)
      .mockRejectedValueOnce(new Error('Polling unavailable'))
      .mockResolvedValueOnce(matchingTerminalPlan)
    getSchedulePlanHistory
      .mockResolvedValueOnce(initialHistory)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([matchingTerminalPlan, initialPlan])
    requestScheduleReplan.mockResolvedValue(submittedAttempt)

    const { result } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const initialUpdatedAt = result.current.lastUpdatedAt

    await act(async () => {
      await result.current.replan()
    })

    expect(result.current.plan).toEqual(initialPlan)
    expect(result.current.history).toEqual(initialHistory)
    expect(result.current.lastUpdatedAt).toBe(initialUpdatedAt)
    expect(result.current.error).toEqual(expect.any(Error))
    expect(result.current.isReplanning).toBe(true)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.plan).toEqual(matchingTerminalPlan)
    expect(result.current.error).toBeNull()
    expect(result.current.isReplanning).toBe(false)
  })

  it('does not continue replan work after unmount', async () => {
    const post = deferred<ScheduleSolveAttemptModel>()
    const { apiClient, getCurrentSchedulePlan, getSchedulePlanHistory, requestScheduleReplan } =
      createApiClient()
    getCurrentSchedulePlan.mockResolvedValue(createPlan())
    getSchedulePlanHistory.mockResolvedValue([])
    requestScheduleReplan.mockReturnValue(post.promise)

    const { result, unmount } = renderWorkbench(apiClient)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let replanWork!: Promise<void>
    act(() => {
      replanWork = result.current.replan()
    })
    await waitFor(() => expect(result.current.isReplanning).toBe(true))
    unmount()

    post.resolve(createAttempt({ id: 77 }))
    await replanWork

    expect(getCurrentSchedulePlan).toHaveBeenCalledTimes(1)
    expect(getSchedulePlanHistory).toHaveBeenCalledTimes(1)
  })
})
