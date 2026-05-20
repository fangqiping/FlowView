import type { ExecutableDetailModel, FlowTaskDetail, OrderKind } from '../types'

export interface ExecutionStep {
  id: number
  executableType: number
  parentFlowTaskId?: number | null
  nodeId: string
  acknowledged: boolean
  status: number
  scheduledTime?: string | null
  startingTime?: string | null
  finishedTime?: string | null
}

export interface EffectiveOrderSnapshot {
  status: number
  completedTime?: string | null
}

export interface ExecutionGraphNode {
  id: string
  position: { x: number; y: number }
  data: {
    label: string
    detail: ExecutionStep
  }
}

export interface ExecutionGraphEdge {
  id: string
  source: string
  target: string
}

export type ExecutableAction = 'cancel' | 'skip' | 'retry'

export interface ExecutableActionSet {
  flowActions: ExecutableAction[]
  nodeActions: ExecutableAction[]
}

type ActionableExecutable = Pick<
  ExecutableDetailModel,
  'id' | 'executableType' | 'status' | 'parentFlowTaskId' | 'acknowledged'
>

export function createSuggestedOrderCode(kind: OrderKind, when = new Date()): string {
  const prefix = kind === 'inbound' ? 'IN' : 'OUT'
  const yyyy = when.getFullYear()
  const mm = `${when.getMonth() + 1}`.padStart(2, '0')
  const dd = `${when.getDate()}`.padStart(2, '0')
  const hh = `${when.getHours()}`.padStart(2, '0')
  const mi = `${when.getMinutes()}`.padStart(2, '0')
  const ss = `${when.getSeconds()}`.padStart(2, '0')

  return `${prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

export function getExecutionSteps(task: FlowTaskDetail | null): ExecutionStep[] {
  if (!task?.executableDetailModels?.length) {
    return []
  }

  return task.executableDetailModels
    .filter((detail) => detail.nodeId && detail.nodeId !== 'Root')
    .map((detail) => toExecutionStep(detail))
    .sort((left, right) => {
      const leftTime = Date.parse(left.scheduledTime ?? '') || 0
      const rightTime = Date.parse(right.scheduledTime ?? '') || 0
      return leftTime - rightTime
    })
}

export function getEffectiveOrderSnapshot(
  order: { status: number; flowTaskId?: number | null; completedTime?: string | null },
  task: FlowTaskDetail | null,
): EffectiveOrderSnapshot {
  if (!task || order.flowTaskId !== task.id || !isTerminalFlowTaskStatus(task.status)) {
    return {
      status: order.status,
      completedTime: order.completedTime ?? null,
    }
  }

  return {
    status: mapOrderStatus(task.status),
    completedTime: task.finishedTime ?? order.completedTime ?? null,
  }
}

export function toTaskSnapshot(task: FlowTaskDetail): EffectiveOrderSnapshot {
  return {
    status: mapOrderStatus(task.status),
    completedTime: task.finishedTime ?? null,
  }
}

export function applyOrderTaskSnapshots<T extends {
  status: number
  flowTaskId?: number | null
  completedTime?: string | null
}>(
  orders: T[],
  snapshots: ReadonlyMap<number, EffectiveOrderSnapshot>,
): T[] {
  return orders.map((order) => {
    if (!order.flowTaskId) {
      return order
    }

    const snapshot = snapshots.get(order.flowTaskId)
    if (!snapshot) {
      return order
    }

    if (snapshot.status === order.status && snapshot.completedTime === (order.completedTime ?? null)) {
      return order
    }

    return {
      ...order,
      status: snapshot.status,
      completedTime: snapshot.completedTime ?? null,
    }
  })
}

export function getExecutableActions(
  task: FlowTaskDetail | null,
  selectedNode: ActionableExecutable | null,
): ExecutableActionSet {
  const flowActions =
    task && !isTerminalFlowTaskStatus(task.status)
      ? (['cancel'] as ExecutableAction[])
      : []

  if (
    selectedNode
    && selectedNode.parentFlowTaskId
    && task?.status === 3
    && !selectedNode.acknowledged
    && (selectedNode.status === 6 || selectedNode.status === 8)
  ) {
    return {
      flowActions,
      nodeActions: ['retry', 'skip'],
    }
  }

  if (!selectedNode || isTerminalFlowTaskStatus(selectedNode.status) || !selectedNode.parentFlowTaskId) {
    return {
      flowActions,
      nodeActions: [],
    }
  }

  if (selectedNode.acknowledged) {
    return {
      flowActions,
      nodeActions: [],
    }
  }

  if (selectedNode.executableType === 0 || selectedNode.executableType === 1) {
    return {
      flowActions,
      nodeActions: ['cancel'],
    }
  }

  return {
    flowActions,
    nodeActions: [],
  }
}

export function getExecutableActionHint(
  task: FlowTaskDetail | null,
  selectedNode: ActionableExecutable | null,
): string | null {
  if (!selectedNode) {
    return null
  }

  if (selectedNode.status === 4) {
    return 'Completed nodes do not support retry or skip.'
  }

  if (selectedNode.acknowledged) {
    return 'This node has already been acknowledged by the parent flow.'
  }

  if (!selectedNode.parentFlowTaskId) {
    return null
  }

  if (task?.status !== 3) {
    return 'Node actions are available only while the parent flow is still running.'
  }

  if (selectedNode.status === 3) {
    return 'This node can be canceled while it is running.'
  }

  if (selectedNode.status === 6) {
    return 'This node can be retried or skipped after it fails.'
  }

  if (selectedNode.status === 8) {
    return 'This node can be retried or skipped after it is canceled.'
  }

  return null
}

export function buildExecutionGraph(task: FlowTaskDetail | null): {
  nodes: ExecutionGraphNode[]
  edges: ExecutionGraphEdge[]
} {
  const steps = getExecutionSteps(task)
  const nodes = steps.map((step, index) => ({
    id: `step-${step.id}`,
    position: { x: 80 + index * 240, y: 120 },
    data: {
      label: step.nodeId,
      detail: step,
    },
  }))
  const edges = nodes.slice(1).map((node, index) => ({
    id: `${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id,
  }))

  return { nodes, edges }
}

function toExecutionStep(detail: ExecutableDetailModel): ExecutionStep {
  return {
    id: detail.id,
    executableType: detail.executableType,
    parentFlowTaskId: detail.parentFlowTaskId,
    nodeId: detail.nodeId ?? 'Unknown',
    acknowledged: detail.acknowledged,
    status: detail.status,
    scheduledTime: detail.scheduledTime,
    startingTime: detail.startingTime,
    finishedTime: detail.finishedTime,
  }
}

export function isTerminalFlowTaskStatus(status: number) {
  return status === 4 || status === 6 || status === 8
}

function mapOrderStatus(taskStatus: number) {
  switch (taskStatus) {
    case 4:
      return 3
    case 6:
      return 5
    case 8:
      return 4
    default:
      return 2
  }
}
