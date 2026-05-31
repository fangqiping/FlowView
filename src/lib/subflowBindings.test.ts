import { describe, expect, it } from 'vitest'
import type { FlowCatalogModel, FlowDefinitionSummaryModel } from '../types'
import { buildSubFlowInputBindings, buildSubFlowOutputBindings, findSubFlowCandidate } from './subflowBindings'

describe('subflowBindings', () => {
  const definitions: FlowDefinitionSummaryModel[] = [
    {
      code: 'child-flow',
      name: 'Child Flow',
      status: 'Active',
      activeVersionNumber: 2,
      activeRuntimeFlowId: 'db:child-flow:v2',
      createdAt: '',
      updatedAt: '',
    },
  ]
  const catalog: FlowCatalogModel = {
    operations: [],
    variableTypes: [],
    expressionOperators: [],
    subFlowTemplates: [
      {
        code: 'child-flow',
        name: 'Child Flow',
        versionNumber: 2,
        runtimeFlowId: 'db:child-flow:v2',
        inputs: [{ id: 'OrderCode', type: 'string' }],
        outputs: [{ id: 'Status', type: 'string' }],
      },
    ],
  }

  it('resolves a candidate by code and active catalog template', () => {
    const candidate = findSubFlowCandidate('child-flow', definitions, catalog)

    expect(candidate?.code).toBe('child-flow')
    expect(candidate?.activeVersionNumber).toBe(2)
    expect(candidate?.inputs.map((item) => item.id)).toEqual(['OrderCode'])
  })

  it('builds signature-aware input bindings', () => {
    expect(buildSubFlowInputBindings([{ id: 'OrderCode', type: 'string' }], { OrderCode: 'ParentOrderCode' })).toEqual([
      { source: 'ParentOrderCode', destination: 'OrderCode' },
    ])
  })

  it('builds signature-aware output bindings', () => {
    expect(buildSubFlowOutputBindings([{ id: 'Status', type: 'string' }], { Status: 'ParentStatus' })).toEqual([
      { source: 'Status', destination: 'ParentStatus' },
    ])
  })
})
