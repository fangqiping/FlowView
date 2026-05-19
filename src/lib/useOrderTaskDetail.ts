import { useCallback, useEffect, useState } from 'react'
import type { FlowTaskDetail } from '../types'

const TERMINAL_FLOW_TASK_STATUSES = new Set([4, 6, 8])

export interface UseOrderTaskDetailOptions {
  taskId: number | null
  fetchTask: (taskId: number) => Promise<FlowTaskDetail>
  pollIntervalMs?: number
}

export function useOrderTaskDetail({
  taskId,
  fetchTask,
  pollIntervalMs = 2000,
}: UseOrderTaskDetailOptions) {
  const [task, setTask] = useState<FlowTaskDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (taskId == null) {
      setTask(null)
      setError(null)
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const nextTask = await fetchTask(taskId)
      setTask(nextTask)
      return nextTask
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load flow task.')
      return null
    } finally {
      setLoading(false)
    }
  }, [fetchTask, taskId])

  useEffect(() => {
    if (taskId == null) {
      window.setTimeout(() => {
        setTask(null)
        setError(null)
      }, 0)
      return
    }

    let cancelled = false
    let timeoutId: number | undefined

    const tick = async () => {
      const nextTask = await refresh()

      if (
        cancelled ||
        !nextTask ||
        TERMINAL_FLOW_TASK_STATUSES.has(nextTask.status)
      ) {
        return
      }

      timeoutId = window.setTimeout(() => {
        void tick()
      }, pollIntervalMs)
    }

    void tick()

    return () => {
      cancelled = true
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [pollIntervalMs, refresh, taskId])

  return {
    task,
    loading,
    error,
    refresh,
  }
}
