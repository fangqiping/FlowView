import { useCallback, useEffect, useRef, useState } from 'react'
import type { SchedulePlanModel } from '../types'
import { api, ApiError } from './api'

const TERMINAL_SOLVE_ATTEMPT_STATUSES = new Set([2, 3])

export type SchedulingWorkbenchApi = Pick<
  typeof api,
  | 'getCurrentSchedulePlan'
  | 'getSchedulePlanHistory'
  | 'requestScheduleReplan'
>

export interface SchedulingWorkbenchState {
  plan: SchedulePlanModel | null
  history: SchedulePlanModel[]
  error: Error | null
  lastUpdatedAt: Date | null
  isLoading: boolean
  isReplanning: boolean
  refresh(): Promise<void>
  replan(): Promise<void>
}

export interface UseSchedulingWorkbenchOptions {
  pollIntervalMs?: number
  apiClient?: SchedulingWorkbenchApi
}

function toError(caught: unknown): Error {
  return caught instanceof Error
    ? caught
    : new Error()
}

async function getCurrentPlan(
  apiClient: SchedulingWorkbenchApi,
): Promise<SchedulePlanModel | null> {
  try {
    return await apiClient.getCurrentSchedulePlan()
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) {
      return null
    }

    throw caught
  }
}

interface GenerationPromise {
  generation: number
  promise: Promise<void>
}

interface SubmittedAttempt {
  generation: number
  id: number
}

function clearWhenSettled(promise: Promise<void>, clear: () => void) {
  void promise.then(clear, clear)
}

export function useSchedulingWorkbench(
  options: UseSchedulingWorkbenchOptions = {},
): SchedulingWorkbenchState {
  const { pollIntervalMs = 5000, apiClient = api } = options
  const [plan, setPlan] = useState<SchedulePlanModel | null>(null)
  const [history, setHistory] = useState<SchedulePlanModel[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReplanning, setIsReplanning] = useState(false)
  const mountedRef = useRef(false)
  const apiClientRef = useRef(apiClient)
  const clientGenerationRef = useRef(0)
  const refreshPromiseRef = useRef<GenerationPromise | null>(null)
  const replanPromiseRef = useRef<GenerationPromise | null>(null)
  const submittedAttemptRef = useRef<SubmittedAttempt | null>(null)

  const startRefresh = useCallback((
    generation: number,
    resetLifecycle = false,
  ): Promise<void> => {
    if (
      !mountedRef.current ||
      generation === 0 ||
      clientGenerationRef.current !== generation
    ) {
      return Promise.resolve()
    }

    const existingRefresh = refreshPromiseRef.current
    if (existingRefresh?.generation === generation) {
      return existingRefresh.promise
    }

    const currentApiClient = apiClientRef.current
    const currentRequest = getCurrentPlan(currentApiClient)
    const historyRequest = currentApiClient.getSchedulePlanHistory()
    const requests = Promise.allSettled([currentRequest, historyRequest])
    const work = (async () => {
      await Promise.resolve()

      if (
        !mountedRef.current ||
        clientGenerationRef.current !== generation
      ) {
        return
      }

      setIsLoading(true)
      if (
        resetLifecycle &&
        replanPromiseRef.current?.generation !== generation &&
        submittedAttemptRef.current?.generation !== generation
      ) {
        setIsReplanning(false)
      }

      try {
        const [currentResult, historyResult] = await requests

        if (currentResult.status === 'rejected') {
          throw currentResult.reason
        }
        if (historyResult.status === 'rejected') {
          throw historyResult.reason
        }

        if (
          !mountedRef.current ||
          clientGenerationRef.current !== generation
        ) {
          return
        }

        const nextPlan = currentResult.value
        setPlan(nextPlan)
        setHistory(historyResult.value)
        setLastUpdatedAt(new Date())
        setError(null)

        const submittedAttempt = submittedAttemptRef.current
        const latestAttempt = nextPlan?.latestSolveAttempt
        if (
          submittedAttempt?.generation === generation &&
          latestAttempt?.id === submittedAttempt.id &&
          TERMINAL_SOLVE_ATTEMPT_STATUSES.has(latestAttempt.status)
        ) {
          submittedAttemptRef.current = null
          setIsReplanning(false)
        }
      } catch (caught) {
        if (
          mountedRef.current &&
          clientGenerationRef.current === generation
        ) {
          setError(toError(caught))
        }
      } finally {
        if (
          mountedRef.current &&
          clientGenerationRef.current === generation
        ) {
          setIsLoading(false)
        }
      }
    })()

    const entry = { generation, promise: work }
    refreshPromiseRef.current = entry
    clearWhenSettled(work, () => {
      if (refreshPromiseRef.current === entry) {
        refreshPromiseRef.current = null
      }
    })
    return work
  }, [])

  const refresh = useCallback((): Promise<void> => {
    return startRefresh(clientGenerationRef.current)
  }, [startRefresh])

  const replan = useCallback((): Promise<void> => {
    const generation = clientGenerationRef.current
    if (!mountedRef.current || generation === 0) {
      return Promise.resolve()
    }

    const existingReplan = replanPromiseRef.current
    if (existingReplan?.generation === generation) {
      return existingReplan.promise
    }

    if (submittedAttemptRef.current?.generation === generation) {
      return Promise.resolve()
    }

    const work = (async () => {
      setIsReplanning(true)
      setError(null)

      try {
        const submittedAttempt = await apiClientRef.current.requestScheduleReplan()
        if (
          !mountedRef.current ||
          clientGenerationRef.current !== generation
        ) {
          return
        }

        const preexistingRefresh = refreshPromiseRef.current
        if (preexistingRefresh?.generation === generation) {
          await preexistingRefresh.promise
        }

        if (
          !mountedRef.current ||
          clientGenerationRef.current !== generation
        ) {
          return
        }

        submittedAttemptRef.current = {
          generation,
          id: submittedAttempt.id,
        }
        await startRefresh(generation)
      } catch (caught) {
        if (
          mountedRef.current &&
          clientGenerationRef.current === generation
        ) {
          if (submittedAttemptRef.current?.generation === generation) {
            submittedAttemptRef.current = null
          }
          setError(toError(caught))
          setIsReplanning(false)
        }
      }
    })()

    const entry = { generation, promise: work }
    replanPromiseRef.current = entry
    clearWhenSettled(work, () => {
      if (replanPromiseRef.current === entry) {
        replanPromiseRef.current = null
      }
    })
    return work
  }, [startRefresh])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    apiClientRef.current = apiClient
    clientGenerationRef.current += 1
    const generation = clientGenerationRef.current
    void startRefresh(generation, true)
  }, [apiClient, startRefresh])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh()
    }, pollIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pollIntervalMs, refresh])

  return {
    plan,
    history,
    error,
    lastUpdatedAt,
    isLoading,
    isReplanning,
    refresh,
    replan,
  }
}
