import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FlowTaskDetail } from '../types'
import { useOrderTaskDetail } from './useOrderTaskDetail'

function createTask(status: number): FlowTaskDetail {
  return {
    id: 42,
    executableType: 1,
    flowId: 'demo-flow',
    acknowledged: true,
    status,
    scheduledTime: '2026-05-18T10:00:00Z',
  }
}

describe('useOrderTaskDetail', () => {
  it('does not fetch when task id is missing', () => {
    const fetchTask = vi.fn()

    const { result } = renderHook(() =>
      useOrderTaskDetail({
        taskId: null,
        fetchTask,
        pollIntervalMs: 10,
      }),
    )

    expect(fetchTask).not.toHaveBeenCalled()
    expect(result.current.task).toBeNull()
  })

  it('keeps polling while the task is active and stops on completion', async () => {
    const fetchTask = vi.fn<(taskId: number) => Promise<FlowTaskDetail>>()
    fetchTask
      .mockResolvedValueOnce(createTask(3))
      .mockResolvedValueOnce(createTask(4))

    const { result } = renderHook(() =>
      useOrderTaskDetail({
        taskId: 42,
        fetchTask,
        pollIntervalMs: 20,
      }),
    )

    await waitFor(() => expect(result.current.task?.status).toBe(4))
    await waitFor(() => expect(fetchTask).toHaveBeenCalledTimes(2))

    await new Promise((resolve) => window.setTimeout(resolve, 40))
    await waitFor(() => expect(result.current.task?.status).toBe(4))
    expect(fetchTask).toHaveBeenCalledTimes(2)
  })
})
