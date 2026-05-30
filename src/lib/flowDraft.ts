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
export type FlowEdge = Edge

export interface SubFlowNodeTemplate {
  code: string
  name: string
  description?: string | null
  inputs: SubFlowVariableSignatureModel[]
  outputs: SubFlowVariableSignatureModel[]
}

export const ROOT_NODE_ID = 'Root'
export const EDITOR_VARIABLE_TYPES = ['string', 'bool', 'int', 'long', 'float'] as const

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

  const edges = document.routes.flatMap((route, routeIndex) =>
    route.targets.map((target, targetIndex) => ({
      id: `${route.source}-${target}-${routeIndex}-${targetIndex}`,
      source: route.source,
      target,
      label: route.condition ?? undefined,
      animated: route.source === ROOT_NODE_ID,
    })),
  )

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

  const routes: DraftRoute[] = Object.values(
    edges.reduce<Record<string, DraftRoute>>((acc, edge) => {
      if (!acc[edge.source]) {
        acc[edge.source] = {
          type: 0,
          source: edge.source,
          targets: [],
          kind: 0,
        }
      }
      acc[edge.source].targets.push(edge.target)
      return acc
    }, {}),
  )

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
  return addEdge({ ...connection, animated: connection.source === ROOT_NODE_ID }, edges)
}

export function toPascalCase(input: string): string {
  return input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
