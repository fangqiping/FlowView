import { describe, expect, it } from 'vitest'
import { LOCAL_OPERATION_LIBRARY, EDITOR_VARIABLE_TYPES } from './flowDraft'
import { buildCatalogSummary, getVisibleSubFlowTemplates } from './flowCatalogSummary'
import type { FlowCatalogModel } from '../types'

describe('flowCatalogSummary', () => {
  it('uses the same counts as the visible editor libraries', () => {
    const catalog: FlowCatalogModel = {
      operations: [
        {
          key: 'backend-op-1',
          name: 'Backend 1',
          operationTaskTypeName: 'A',
          inputs: [],
          outputs: [],
          signatureHash: 'a',
        },
        {
          key: 'backend-op-2',
          name: 'Backend 2',
          operationTaskTypeName: 'B',
          inputs: [],
          outputs: [],
          signatureHash: 'b',
        },
        {
          key: 'backend-op-3',
          name: 'Backend 3',
          operationTaskTypeName: 'C',
          inputs: [],
          outputs: [],
          signatureHash: 'c',
        },
        {
          key: 'backend-op-4',
          name: 'Backend 4',
          operationTaskTypeName: 'D',
          inputs: [],
          outputs: [],
          signatureHash: 'd',
        },
      ],
      variableTypes: [
        { key: 'string' },
        { key: 'bool' },
        { key: 'int' },
        { key: 'long' },
        { key: 'float' },
        { key: 'DateTimeOffset' },
        { key: 'TimeSpan' },
      ],
      subFlowTemplates: [
        { code: 'inbound-basic', name: 'Inbound', versionNumber: 1, runtimeFlowId: 'db:inbound', inputs: [], outputs: [] },
        { code: 'outbound-basic', name: 'Outbound', versionNumber: 1, runtimeFlowId: 'db:outbound', inputs: [], outputs: [] },
      ],
      expressionOperators: [],
    }

    expect(buildCatalogSummary(catalog, 'inbound-basic')).toEqual({
      operations: LOCAL_OPERATION_LIBRARY.length,
      subflows: 1,
      variableTypes: EDITOR_VARIABLE_TYPES.length,
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
