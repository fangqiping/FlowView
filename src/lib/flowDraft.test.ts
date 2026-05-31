import { describe, expect, it } from 'vitest'
import { addSubFlowNode } from './flowDraft'

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
