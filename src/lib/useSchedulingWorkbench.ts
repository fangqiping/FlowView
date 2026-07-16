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
  replanTimeoutMs?: number
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
  const { pollIntervalMs = 5000, replanTimeoutMs = 120_000, apiClient = api } = options
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
  const replanTimeoutIdRef = useRef<number | null>(null)
  const replanTimeoutMsRef = useRef(replanTimeoutMs)

  const clearReplanTimeout = useCallback(() => {
    if (replanTimeoutIdRef.current !== null) {
      window.clearTimeout(replanTimeoutIdRef.current)
      replanTimeoutIdRef.current = null
    }
  }, [])

  const finishSubmittedAttempt = useCallback((generation: number) => {
    if (submittedAttemptRef.current?.generation !== generation) return

    submittedAttemptRef.current = null
    clearReplanTimeout()
    if (mountedRef.current && clientGenerationRef.current === generation) {
      setIsReplanning(false)
    }
  }, [clearReplanTimeout])

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
        if (submittedAttempt?.generation === generation && latestAttempt !== null && latestAttempt !== undefined) {
          const submittedAttemptFinished = latestAttempt.id === submittedAttempt.id
            && TERMINAL_SOLVE_ATTEMPT_STATUSES.has(latestAttempt.status)
          const submittedAttemptSuperseded = latestAttempt.id > submittedAttempt.id
            && TERMINAL_SOLVE_ATTEMPT_STATUSES.has(latestAttempt.status)
          if (submittedAttemptFinished || submittedAttemptSuperseded) {
            finishSubmittedAttempt(generation)
          }
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
  }, [finishSubmittedAttempt])

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
        clearReplanTimeout()
        const timeoutMs = replanTimeoutMsRef.current
        if (Number.isFinite(timeoutMs) && timeoutMs >= 0) {
          replanTimeoutIdRef.current = window.setTimeout(() => {
            finishSubmittedAttempt(generation)
          }, timeoutMs)
        }
        await startRefresh(generation)
      } catch (caught) {
        if (
          mountedRef.current &&
          clientGenerationRef.current === generation
        ) {
          if (submittedAttemptRef.current?.generation === generation) {
            finishSubmittedAttempt(generation)
          }
          setError(toError(caught))
          if (submittedAttemptRef.current?.generation !== generation) {
            setIsReplanning(false)
          }
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
  }, [clearReplanTimeout, finishSubmittedAttempt, startRefresh])

  useEffect(() => {
    replanTimeoutMsRef.current = replanTimeoutMs
  }, [replanTimeoutMs])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      clearReplanTimeout()
    }
  }, [clearReplanTimeout])

  useEffect(() => {
    clearReplanTimeout()
    submittedAttemptRef.current = null
    apiClientRef.current = apiClient
    clientGenerationRef.current += 1
    const generation = clientGenerationRef.current
    void startRefresh(generation, true)
  }, [apiClient, clearReplanTimeout, startRefresh])

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
