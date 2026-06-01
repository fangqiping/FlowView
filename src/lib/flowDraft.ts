import type { Connection, Edge, Node, Viewport } from '@xyflow/react'
import { addEdge } from '@xyflow/react'
import type { DraftDocument, DraftNode, DraftRoute, DraftVariable, SubFlowVariableSignatureModel } from '../types'

export interface FlowNodeData extends Record<string, unknown> {
  label: string
  kind: 'root' | 'operation' | 'subflow'
  description: string
  consoleId: string
  operationTaskType: string
  flowId: string
  inputs: Array<{ source: string; destination: string }>
  outputs: Array<{ source: string; destination: string }>
  shouldThrowOnFailed: boolean
  shouldThrowOnCanceled: boolean
}

export type FlowNode = Node<FlowNodeData>
export type RouteKind = 'direct' | 'condition' | 'switch'
export type RouteTargetRole = 'true' | 'false' | 'case'

export interface FlowEdgeData extends Record<string, unknown> {
  routeKind: RouteKind
  routeCondition?: string
  routeTargetIndex: number
  routeCaseValue?: number
  routeTargetRole?: RouteTargetRole
}

export type FlowEdge = Edge<FlowEdgeData>

export interface SubFlowNodeTemplate {
  code: string
  name: string
  description?: string | null
  inputs: SubFlowVariableSignatureModel[]
  outputs: SubFlowVariableSignatureModel[]
}

export const ROOT_NODE_ID = 'Root'
export const EDITOR_VARIABLE_TYPES = ['string', 'bool', 'int', 'long', 'float'] as const

const ROUTE_KIND_TO_DRAFT_KIND: Record<RouteKind, DraftRoute['kind']> = {
  direct: 0,
  condition: 1,
  switch: 2,
}

export const LOCAL_OPERATION_LIBRARY = [
  {
    key: 'conveyor-transfer',
    name: 'Conveyor Transfer',
    consoleId: 'ConveyorConsole',
    operationTaskType: 'Backend.Demo.ConveyorTransferOperationTask',
    description: 'Move an order between two stations on the conveyor.',
    inputs: [
      { source: 'OrderCode', destination: 'OrderCode' },
      { source: 'SourceLocationCode', destination: 'FromLocationCode' },
      { source: 'TargetLocationCode', destination: 'ToLocationCode' },
    ],
    outputs: [{ source: 'CompletionMessage', destination: 'Status' }],
  },
  {
    key: 'stackcrane-store',
    name: 'Stack Crane Store',
    consoleId: 'StackCraneConsole',
    operationTaskType: 'Backend.Demo.StackCraneStoreOperationTask',
    description: 'Put away inventory from station into rack location.',
    inputs: [
      { source: 'OrderCode', destination: 'OrderCode' },
      { source: 'SkuCode', destination: 'SkuCode' },
      { source: 'TargetLocationCode', destination: 'TargetLocationCode' },
    ],
    outputs: [{ source: 'CompletionMessage', destination: 'Status' }],
  },
  {
    key: 'stackcrane-retrieve',
    name: 'Stack Crane Retrieve',
    consoleId: 'StackCraneConsole',
    operationTaskType: 'Backend.Demo.StackCraneRetrieveOperationTask',
    description: 'Take inventory from rack location to station.',
    inputs: [
      { source: 'OrderCode', destination: 'OrderCode' },
      { source: 'SkuCode', destination: 'SkuCode' },
      { source: 'SourceLocationCode', destination: 'SourceLocationCode' },
    ],
    outputs: [{ source: 'CompletionMessage', destination: 'Status' }],
  },
] as const

export function createEmptyDraft(code: string, name = code): DraftDocument {
  return {
    id: toPascalCase(name),
    variables: defaultVariables(),
    nodes: [],
    routes: [],
    editorState: {
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  }
}

function defaultVariables(): DraftVariable[] {
  return [
    { id: 'OrderCode', type: 'string', usage: 'input', initialValue: '' },
    { id: 'SourceLocationCode', type: 'string', usage: 'input', initialValue: '' },
    { id: 'TargetLocationCode', type: 'string', usage: 'input', initialValue: '' },
    { id: 'SkuCode', type: 'string', usage: 'input', initialValue: '' },
    { id: 'Status', type: 'string', usage: 'output', initialValue: 'Draft' },
  ]
}

export function parseDraftDocument(json: string, fallbackCode: string): DraftDocument {
  if (!json.trim()) {
    return createEmptyDraft(fallbackCode)
  }

  try {
    const parsed = JSON.parse(json) as DraftDocument
    return {
      ...createEmptyDraft(fallbackCode),
      ...parsed,
      variables: parsed.variables ?? defaultVariables(),
      nodes: parsed.nodes ?? [],
      routes: parsed.routes ?? [],
    }
  } catch {
    return createEmptyDraft(fallbackCode)
  }
}

export function buildFlowGraph(document: DraftDocument): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const rootNode: FlowNode = {
    id: ROOT_NODE_ID,
    type: 'input',
    position: { x: 40, y: 120 },
    deletable: false,
    draggable: false,
    data: {
      label: 'Start',
      kind: 'root',
      description: 'Entry point',
      consoleId: '',
      operationTaskType: '',
      flowId: '',
      inputs: [],
      outputs: [],
      shouldThrowOnFailed: false,
      shouldThrowOnCanceled: false,
    },
  }

  const nodes: FlowNode[] = document.nodes.map((node, index) => ({
    id: node.id,
    type: 'default',
    position: {
      x: 260 + (index % 3) * 240,
      y: 60 + Math.floor(index / 3) * 140,
    },
    data: {
      label: node.id,
      kind: node.nodeType === 'SubFlow' ? 'subflow' : 'operation',
      description: node.description ?? '',
      consoleId: node.consoleId ?? '',
      operationTaskType: node.operationTaskType ?? '',
      flowId: node.flowId ?? '',
      inputs: node.inputs ?? [],
      outputs: node.outputs ?? [],
      shouldThrowOnFailed: node.shouldThrowOnFailed ?? true,
      shouldThrowOnCanceled: node.shouldThrowOnCanceled ?? true,
    },
  }))

  const edges: FlowEdge[] = document.routes.flatMap((route) => {
    const routeKind = toRouteKind(route.kind)
    return route.targets.map((target, targetIndex) =>
      createRouteEdge(route.source, target, routeKind, targetIndex, route.condition, route.caseValues?.[targetIndex]),
    )
  })

  return { nodes: [rootNode, ...nodes], edges }
}

export function buildDraftDocument(
  code: string,
  name: string,
  variables: DraftVariable[],
  nodes: FlowNode[],
  edges: FlowEdge[],
  viewport?: Viewport,
): DraftDocument {
  const flowNodes: DraftNode[] = nodes
    .filter((node) => node.id !== ROOT_NODE_ID)
    .map((node) => ({
      id: node.id,
      nodeType: node.data.kind === 'subflow' ? 'SubFlow' : 'Operation',
      description: node.data.description,
      shouldThrowOnFailed: node.data.shouldThrowOnFailed,
      shouldThrowOnCanceled: node.data.shouldThrowOnCanceled,
      inputs: node.data.inputs,
      outputs: node.data.outputs,
      resourceOutputs: [],
      consoleId: node.data.kind === 'operation' ? node.data.consoleId : undefined,
      operationTaskType: node.data.kind === 'operation' ? node.data.operationTaskType : undefined,
      flowId: node.data.kind === 'subflow' ? node.data.flowId : undefined,
    }))

  const routeGroups = edges.reduce<Record<string, {
    source: string
    routeKind: RouteKind
    routeCondition?: string
    targets: Array<{ target: string; index: number; caseValue?: number }>
  }>>((acc, edge, fallbackIndex) => {
    const data = edgeRouteData(edge, fallbackIndex)
    const routeCondition = data.routeKind === 'direct' ? undefined : data.routeCondition
    const key = `${edge.source}:${data.routeKind}:${routeCondition ?? ''}`
    if (!acc[key]) {
      acc[key] = {
        source: edge.source,
        routeKind: data.routeKind,
        routeCondition,
        targets: [],
      }
    }
    acc[key].targets.push({ target: edge.target, index: data.routeTargetIndex, caseValue: data.routeCaseValue })
    return acc
  }, {})

  const routes: DraftRoute[] = Object.values(routeGroups).map((group) => {
    const orderedTargets = group.targets
      .sort((left, right) => left.index - right.index)
    const targets = orderedTargets.map((item) => item.target)

    return {
      type: 0,
      source: group.source,
      targets,
      kind: ROUTE_KIND_TO_DRAFT_KIND[group.routeKind],
      ...(group.routeKind === 'switch'
        ? { caseValues: orderedTargets.map((item) => item.caseValue ?? item.index) }
        : {}),
      ...(group.routeKind === 'direct' ? {} : { condition: group.routeCondition ?? '' }),
    }
  })

  return {
    id: toPascalCase(name || code),
    variables,
    nodes: flowNodes,
    routes,
    editorState: {
      viewport: viewport ?? { x: 0, y: 0, zoom: 1 },
    },
  }
}

export function addOperationNode(
  nodes: FlowNode[],
  template: (typeof LOCAL_OPERATION_LIBRARY)[number],
): FlowNode[] {
  const count = nodes.filter((node) => node.id !== ROOT_NODE_ID).length + 1
  return [
    ...nodes,
    {
      id: `${template.name.replaceAll(/\s+/g, '')}${count}`,
      type: 'default',
      position: { x: 260 + ((count - 1) % 3) * 240, y: 60 + Math.floor((count - 1) / 3) * 140 },
      data: {
        label: template.name,
        kind: 'operation',
        description: template.description,
        consoleId: template.consoleId,
        operationTaskType: template.operationTaskType,
        flowId: '',
        inputs: [...template.inputs],
        outputs: [...template.outputs],
        shouldThrowOnFailed: true,
        shouldThrowOnCanceled: true,
      },
    },
  ]
}

export function addSubFlowNode(
  nodes: FlowNode[],
  template: SubFlowNodeTemplate,
): FlowNode[] {
  const count = nodes.filter((node) => node.id !== ROOT_NODE_ID).length + 1
  return [
    ...nodes,
    {
      id: `${toPascalCase(template.code)}${count}`,
      type: 'default',
      position: { x: 260 + ((count - 1) % 3) * 240, y: 60 + Math.floor((count - 1) / 3) * 140 },
      data: {
        label: template.name,
        kind: 'subflow',
        description: template.description ?? '',
        consoleId: '',
        operationTaskType: '',
        flowId: template.code,
        inputs: template.inputs.map((item) => ({ source: item.id, destination: item.id })),
        outputs: template.outputs.map((item) => ({ source: item.id, destination: item.id })),
        shouldThrowOnFailed: true,
        shouldThrowOnCanceled: true,
      },
    },
  ]
}

export function connectEdges(edges: FlowEdge[], connection: Connection): FlowEdge[] {
  if (!connection.source || !connection.target) {
    return edges
  }

  const nextIndex = edges.filter((edge) => edge.source === connection.source).length
  return addEdge(
    createRouteEdge(connection.source, connection.target, 'direct', nextIndex),
    edges,
  )
}

function toRouteKind(kind: DraftRoute['kind'] | undefined): RouteKind {
  if (kind === 1) {
    return 'condition'
  }
  if (kind === 2) {
    return 'switch'
  }
  return 'direct'
}

function routeLabel(routeKind: RouteKind, condition: string | null | undefined, targetIndex: number, caseValue?: number): string | undefined {
  if (routeKind === 'condition' && condition) {
    return `${condition}: ${targetIndex === 0 ? 'true' : 'false'}`
  }
  if (routeKind === 'switch' && condition) {
    return `${condition}: ${caseValue ?? targetIndex}`
  }
  return undefined
}

function routeTargetRole(routeKind: RouteKind, targetIndex: number): RouteTargetRole | undefined {
  if (routeKind === 'condition') {
    return targetIndex === 0 ? 'true' : 'false'
  }
  if (routeKind === 'switch') {
    return 'case'
  }
  return undefined
}

export function createRouteEdge(
  source: string,
  target: string,
  routeKind: RouteKind,
  routeTargetIndex: number,
  routeCondition?: string | null,
  routeCaseValue?: number,
): FlowEdge {
  const condition = routeKind === 'direct' ? undefined : routeCondition ?? undefined
  return {
    id: `${source}-${target}-${routeKind}-${condition ?? 'direct'}-${routeTargetIndex}-${routeCaseValue ?? 'index'}`,
    source,
    target,
    label: routeLabel(routeKind, condition, routeTargetIndex, routeCaseValue),
    animated: source === ROOT_NODE_ID,
    data: {
      routeKind,
      routeCondition: condition,
      routeTargetIndex,
      ...(routeKind === 'switch' ? { routeCaseValue: routeCaseValue ?? routeTargetIndex } : {}),
      routeTargetRole: routeTargetRole(routeKind, routeTargetIndex),
    },
  }
}

function edgeRouteData(edge: FlowEdge, fallbackIndex: number): FlowEdgeData {
  return {
    routeKind: edge.data?.routeKind ?? 'direct',
    routeCondition: edge.data?.routeCondition,
    routeTargetIndex: Number.isFinite(edge.data?.routeTargetIndex) ? Number(edge.data?.routeTargetIndex) : fallbackIndex,
    routeCaseValue: Number.isFinite(edge.data?.routeCaseValue) ? Number(edge.data?.routeCaseValue) : undefined,
    routeTargetRole: edge.data?.routeTargetRole,
  }
}

export function toPascalCase(input: string): string {
  return input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
