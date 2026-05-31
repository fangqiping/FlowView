import { describe, expect, it } from 'vitest'
import { addSubFlowNode, buildDraftDocument, buildFlowGraph, type FlowEdge, ROOT_NODE_ID } from './flowDraft'
import type { DraftDocument, DraftVariable } from '../types'

describe('flowDraft subflow nodes', () => {
  it('stores the child flow code as the design-time subflow reference', () => {
    const template = {
      code: 'child-flow',
      name: 'Child Flow',
      versionNumber: 1,
      runtimeFlowId: 'db:child-flow:v1',
      inputs: [],
      outputs: [],
    }

    const nodes = addSubFlowNode([], template)

    expect(nodes[0]?.data.flowId).toBe('child-flow')
  })
})

describe('flowDraft branch routes', () => {
  const variables: DraftVariable[] = [
    { id: 'CanStore', type: 'bool', usage: 'inputOutput', initialValue: true },
    { id: 'BranchIndex', type: 'int', usage: 'inputOutput', initialValue: 0 },
  ]

  it('converts condition routes into labeled true and false edges', () => {
    const document: DraftDocument = {
      id: 'BranchFlow',
      variables,
      nodes: [
        baseNode('CheckInventory'),
        baseNode('StorePallet'),
        baseNode('RejectPallet'),
      ],
      routes: [
        { type: 0, source: 'CheckInventory', targets: ['StorePallet', 'RejectPallet'], kind: 1, condition: 'CanStore' },
      ],
    }

    const { edges } = buildFlowGraph(document)

    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'CheckInventory',
        target: 'StorePallet',
        label: 'CanStore: true',
        data: expect.objectContaining({ routeKind: 'condition', routeCondition: 'CanStore', routeTargetIndex: 0, routeTargetRole: 'true' }),
      }),
      expect.objectContaining({
        source: 'CheckInventory',
        target: 'RejectPallet',
        label: 'CanStore: false',
        data: expect.objectContaining({ routeKind: 'condition', routeCondition: 'CanStore', routeTargetIndex: 1, routeTargetRole: 'false' }),
      }),
    ]))
  })

  it('serializes condition and switch route edge metadata back to draft routes', () => {
    const nodes = buildFlowGraph({
      id: 'BranchFlow',
      variables,
      nodes: [baseNode('CheckInventory'), baseNode('StorePallet'), baseNode('RejectPallet'), baseNode('ManualReview')],
      routes: [],
    }).nodes
    const edges: FlowEdge[] = [
      {
        id: 'condition-true',
        source: 'CheckInventory',
        target: 'StorePallet',
        label: 'CanStore: true',
        data: { routeKind: 'condition', routeCondition: 'CanStore', routeTargetIndex: 0, routeTargetRole: 'true' },
      },
      {
        id: 'condition-false',
        source: 'CheckInventory',
        target: 'RejectPallet',
        label: 'CanStore: false',
        data: { routeKind: 'condition', routeCondition: 'CanStore', routeTargetIndex: 1, routeTargetRole: 'false' },
      },
      {
        id: 'switch-0',
        source: 'RejectPallet',
        target: 'ManualReview',
        label: 'BranchIndex: 0',
        data: { routeKind: 'switch', routeCondition: 'BranchIndex', routeTargetIndex: 0, routeTargetRole: 'case' },
      },
      {
        id: 'switch-1',
        source: 'RejectPallet',
        target: 'StorePallet',
        label: 'BranchIndex: 1',
        data: { routeKind: 'switch', routeCondition: 'BranchIndex', routeTargetIndex: 1, routeTargetRole: 'case' },
      },
      {
        id: 'root-direct',
        source: ROOT_NODE_ID,
        target: 'CheckInventory',
        data: { routeKind: 'direct', routeTargetIndex: 0 },
      },
    ]

    const draft = buildDraftDocument('branch-flow', 'Branch Flow', variables, nodes, edges)

    expect(draft.routes).toEqual(expect.arrayContaining([
      { type: 0, source: 'CheckInventory', targets: ['StorePallet', 'RejectPallet'], kind: 1, condition: 'CanStore' },
      { type: 0, source: 'RejectPallet', targets: ['ManualReview', 'StorePallet'], kind: 2, condition: 'BranchIndex' },
      { type: 0, source: ROOT_NODE_ID, targets: ['CheckInventory'], kind: 0 },
    ]))
  })
})

function baseNode(id: string) {
  return {
    id,
    nodeType: 'Operation' as const,
    description: '',
    shouldThrowOnFailed: true,
    shouldThrowOnCanceled: true,
    inputs: [],
    outputs: [],
    resourceOutputs: [],
    consoleId: 'FunctionConsole',
    operationTaskType: 'Backend.Demo.FunctionOperationTask',
  }
}
