import { describe, expect, it } from 'vitest'
import type { FlowTaskDetail } from '../types'
import {
  applyOrderTaskSnapshots,
  buildExecutionGraph,
  createSuggestedOrderCode,
  findReplacementExecutableId,
  getExecutableActions,
  getExecutableActionHint,
  getEffectiveOrderSnapshot,
  getExecutionSteps,
  toTaskSnapshot,
} from './flowExecution'

describe('flowExecution helpers', () => {
  it('creates stable suggested codes for inbound and outbound orders', () => {
    const sample = new Date('2026-05-19T08:35:23+08:00')

    expect(createSuggestedOrderCode('inbound', sample)).toBe('IN-20260519-083523')
    expect(createSuggestedOrderCode('outbound', sample)).toBe('OUT-20260519-083523')
  })

  it('filters root steps and sorts execution details by scheduled time', () => {
    const task: FlowTaskDetail = {
      id: 7,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 4,
      executableDetailModels: [
        {
          executableType: 0,
          id: 3,
          nodeId: 'Store',
          acknowledged: true,
          status: 4,
          scheduledTime: '2026-05-19T08:35:05+08:00',
        },
        {
          executableType: 0,
          id: 1,
          nodeId: 'Root',
          acknowledged: true,
          status: 4,
          scheduledTime: '2026-05-19T08:35:01+08:00',
        },
        {
          executableType: 0,
          id: 2,
          nodeId: 'Receive',
          acknowledged: true,
          status: 4,
          scheduledTime: '2026-05-19T08:35:03+08:00',
        },
      ],
    }

    expect(getExecutionSteps(task).map((item) => item.nodeId)).toEqual(['Receive', 'Store'])
  })

  it('projects a terminal flow task into the displayed order status', () => {
    const order = {
      id: 9,
      status: 2,
      flowTaskId: 7,
      completedTime: null,
    }
    const task: FlowTaskDetail = {
      id: 7,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 4,
      finishedTime: '2026-05-19T08:35:10+08:00',
    }

    expect(getEffectiveOrderSnapshot(order, task)).toEqual({
      status: 3,
      completedTime: '2026-05-19T08:35:10+08:00',
    })
  })

  it('builds a sequential execution graph for the detail page', () => {
    const task: FlowTaskDetail = {
      id: 7,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 4,
      executableDetailModels: [
        {
          executableType: 0,
          id: 11,
          nodeId: 'Store',
          acknowledged: true,
          status: 4,
          scheduledTime: '2026-05-19T08:35:05+08:00',
          finishedTime: '2026-05-19T08:35:09+08:00',
        },
        {
          executableType: 0,
          id: 10,
          nodeId: 'Receive',
          acknowledged: true,
          status: 4,
          scheduledTime: '2026-05-19T08:35:03+08:00',
          finishedTime: '2026-05-19T08:35:04+08:00',
        },
      ],
    }

    expect(buildExecutionGraph(task)).toEqual({
      nodes: [
        expect.objectContaining({ id: 'step-10', data: expect.objectContaining({ label: 'Receive' }) }),
        expect.objectContaining({ id: 'step-11', data: expect.objectContaining({ label: 'Store' }) }),
      ],
      edges: [
        expect.objectContaining({ id: 'step-10-step-11', source: 'step-10', target: 'step-11' }),
      ],
    })
  })

  it('keeps a terminal order snapshot even after the selected task changes away', () => {
    const orders = [
      { id: 1, status: 2, flowTaskId: 7, completedTime: null },
      { id: 2, status: 0, flowTaskId: null, completedTime: null },
    ]
    const completedTask: FlowTaskDetail = {
      id: 7,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 4,
      finishedTime: '2026-05-19T08:35:10+08:00',
    }

    expect(applyOrderTaskSnapshots(orders, new Map([[7, toTaskSnapshot(completedTask)]]))).toEqual([
      { id: 1, status: 3, flowTaskId: 7, completedTime: '2026-05-19T08:35:10+08:00' },
      { id: 2, status: 0, flowTaskId: null, completedTime: null },
    ])
  })

  it('returns only cancel for active operation tasks', () => {
    const task: FlowTaskDetail = {
      id: 20,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 3,
    }
    const selectedNode = {
      executableType: 0,
      id: 21,
      parentFlowTaskId: 20,
      nodeId: 'Receive',
      acknowledged: false,
      status: 3,
    }

    expect(getExecutableActions(task, selectedNode)).toEqual({
      flowActions: ['cancel'],
      nodeActions: ['cancel'],
    })
    expect(getExecutableActionHint(task, selectedNode)).toBe('This node can be canceled while it is running.')
  })

  it('prefers server-provided available actions for child executables', () => {
    const task: FlowTaskDetail = {
      id: 20,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 3,
      availableActions: ['cancel'],
    }
    const selectedNode = {
      executableType: 0,
      id: 21,
      parentFlowTaskId: 20,
      nodeId: 'Receive',
      acknowledged: false,
      status: 3,
      availableActions: ['restart', 'skip'],
    }

    expect(getExecutableActions(task, selectedNode)).toEqual({
      flowActions: ['cancel'],
      nodeActions: ['retry', 'skip'],
    })
  })

  it('hides child actions when the server returns no available actions', () => {
    const task: FlowTaskDetail = {
      id: 20,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 3,
      availableActions: ['cancel'],
    }
    const selectedNode = {
      executableType: 0,
      id: 21,
      parentFlowTaskId: 20,
      nodeId: 'Receive',
      acknowledged: false,
      status: 3,
      availableActions: [],
    }

    expect(getExecutableActions(task, selectedNode)).toEqual({
      flowActions: ['cancel'],
      nodeActions: [],
    })
  })

  it('hides child actions when the parent flow is no longer running even if stale actions are present', () => {
    const task: FlowTaskDetail = {
      id: 20,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 8,
      availableActions: [],
    }
    const selectedNode = {
      executableType: 0,
      id: 21,
      parentFlowTaskId: 20,
      nodeId: 'Receive',
      acknowledged: false,
      status: 3,
      availableActions: ['cancel'],
    }

    expect(getExecutableActions(task, selectedNode)).toEqual({
      flowActions: [],
      nodeActions: [],
    })
    expect(getExecutableActionHint(task, selectedNode)).toBe(
      'Node actions are available only while the parent flow is still running.',
    )
  })

  it('returns retry and skip for failed child executables', () => {
    const task: FlowTaskDetail = {
      id: 20,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 3,
    }
    const selectedNode = {
      executableType: 1,
      id: 22,
      parentFlowTaskId: 20,
      nodeId: 'SubFlow-A',
      acknowledged: false,
      status: 6,
    }

    expect(getExecutableActions(task, selectedNode)).toEqual({
      flowActions: ['cancel'],
      nodeActions: ['retry', 'skip'],
    })
    expect(getExecutableActionHint(task, selectedNode)).toBe('This node can be retried or skipped after it fails.')
  })

  it('returns retry and skip for canceled child executables', () => {
    const task: FlowTaskDetail = {
      id: 20,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 3,
    }
    const selectedNode = {
      executableType: 0,
      id: 23,
      parentFlowTaskId: 20,
      nodeId: 'Receive',
      acknowledged: false,
      status: 8,
    }

    expect(getExecutableActions(task, selectedNode)).toEqual({
      flowActions: ['cancel'],
      nodeActions: ['retry', 'skip'],
    })
    expect(getExecutableActionHint(task, selectedNode)).toBe('This node can be retried or skipped after it is canceled.')
  })

  it('hides retry after a canceled child has already been acknowledged by a finished flow', () => {
    const task: FlowTaskDetail = {
      id: 20,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 8,
    }
    const selectedNode = {
      executableType: 0,
      id: 22,
      parentFlowTaskId: 20,
      nodeId: 'Receive',
      acknowledged: true,
      status: 8,
    }

    expect(getExecutableActions(task, selectedNode)).toEqual({
      flowActions: [],
      nodeActions: [],
    })
    expect(getExecutableActionHint(task, selectedNode)).toBe('This node has already been acknowledged by the parent flow.')
  })

  it('returns no actions for completed child executables', () => {
    const task: FlowTaskDetail = {
      id: 20,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 4,
    }
    const selectedNode = {
      executableType: 1,
      id: 22,
      parentFlowTaskId: 20,
      nodeId: 'SubFlow-A',
      acknowledged: true,
      status: 4,
    }

    expect(getExecutableActions(task, selectedNode)).toEqual({
      flowActions: [],
      nodeActions: [],
    })
    expect(getExecutableActionHint(task, selectedNode)).toBe('Completed nodes do not support retry or skip.')
  })

  it('finds the replacement executable created by retrying a node', () => {
    const task: FlowTaskDetail = {
      id: 30,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 3,
      executableDetailModels: [
        {
          executableType: 0,
          id: 101,
          parentFlowTaskId: 30,
          nodeId: 'Receive',
          acknowledged: true,
          status: 8,
          scheduledTime: '2026-05-21T23:10:00+08:00',
        },
        {
          executableType: 0,
          id: 102,
          parentFlowTaskId: 30,
          nodeId: 'Receive',
          acknowledged: false,
          status: 3,
          scheduledTime: '2026-05-21T23:10:05+08:00',
        },
      ],
    }

    expect(
      findReplacementExecutableId(task, {
        executableType: 0,
        id: 101,
        parentFlowTaskId: 30,
        nodeId: 'Receive',
      }),
    ).toBe(102)
  })

  it('does not treat acknowledged or mismatched nodes as retry replacements', () => {
    const task: FlowTaskDetail = {
      id: 30,
      executableType: 1,
      flowId: 'db:inbound-basic:v1',
      acknowledged: true,
      status: 3,
      executableDetailModels: [
        {
          executableType: 0,
          id: 201,
          parentFlowTaskId: 30,
          nodeId: 'Receive',
          acknowledged: true,
          status: 8,
          scheduledTime: '2026-05-21T23:10:00+08:00',
        },
        {
          executableType: 0,
          id: 202,
          parentFlowTaskId: 30,
          nodeId: 'Store',
          acknowledged: false,
          status: 3,
          scheduledTime: '2026-05-21T23:10:05+08:00',
        },
        {
          executableType: 0,
          id: 203,
          parentFlowTaskId: 30,
          nodeId: 'Receive',
          acknowledged: true,
          status: 3,
          scheduledTime: '2026-05-21T23:10:06+08:00',
        },
      ],
    }

    expect(
      findReplacementExecutableId(task, {
        executableType: 0,
        id: 201,
        parentFlowTaskId: 30,
        nodeId: 'Receive',
      }),
    ).toBeNull()
  })
})
