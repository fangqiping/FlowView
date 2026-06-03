import { describe, expect, it } from 'vitest'
import { buildDraftGraphSummary, getVisibleSubFlowTemplates } from './flowCatalogSummary'
import type { FlowCatalogModel, FlowDraftModel } from '../types'

describe('flowCatalogSummary', () => {
  it('counts the selected draft graph entries', () => {
    const draft: FlowDraftModel = {
      code: 'inbound-basic',
      name: 'Inbound',
      revision: 3,
      updatedAt: new Date().toISOString(),
      draftDocumentJson: JSON.stringify({
        variables: [
          { id: 'OrderCode', type: 'string', usage: 'input', initialValue: '' },
          { id: 'Status', type: 'string', usage: 'output', initialValue: '' },
          { id: 'RetryCount', type: 'int', usage: 'inputOutput', initialValue: 0 },
        ],
        nodes: [
          { id: 'Receive', nodeType: 'Operation', inputs: [], outputs: [], resourceOutputs: [], shouldThrowOnFailed: true, shouldThrowOnCanceled: true },
          { id: 'Putaway', nodeType: 'Operation', inputs: [], outputs: [], resourceOutputs: [], shouldThrowOnFailed: true, shouldThrowOnCanceled: true },
          { id: 'AuditChildFlow', nodeType: 'SubFlow', inputs: [], outputs: [], resourceOutputs: [], shouldThrowOnFailed: true, shouldThrowOnCanceled: true },
        ],
        routes: [],
      }),
    }

    expect(buildDraftGraphSummary(draft)).toEqual({
      operations: 2,
      subflows: 1,
      variables: 3,
    })
  })

  it('filters the current flow out of visible subflow templates', () => {
    const catalog: FlowCatalogModel = {
      operations: [],
      variableTypes: [],
      subFlowTemplates: [
        { code: 'inbound-basic', name: 'Inbound', versionNumber: 1, runtimeFlowId: 'db:inbound', inputs: [], outputs: [] },
        { code: 'outbound-basic', name: 'Outbound', versionNumber: 1, runtimeFlowId: 'db:outbound', inputs: [], outputs: [] },
      ],
      expressionOperators: [],
    }

    expect(getVisibleSubFlowTemplates(catalog, 'inbound-basic').map((item) => item.code)).toEqual(['outbound-basic'])
  })
})
