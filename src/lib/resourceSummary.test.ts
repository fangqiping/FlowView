import { describe, expect, it } from 'vitest'
import type { FlowTaskDetail, LocationModel, PalletModel, SkuModel } from '../types'
import {
  buildExecutionResourceSummary,
  buildOrderResourceSummary,
  toSelectionSourceLabel,
} from './resourceSummary'

describe('resourceSummary helpers', () => {
  const locations: LocationModel[] = [
    {
      id: 2,
      code: 'RACK-A1',
      name: 'Rack A1',
      enabled: true,
      acquired: false,
      locationType: 1,
      status: 1,
      warehouseId: 1,
      currentPalletId: 2,
    },
    {
      id: 3,
      code: 'RACK-A2',
      name: 'Rack A2',
      enabled: true,
      acquired: true,
      locationType: 1,
      status: 2,
      warehouseId: 1,
      currentPalletId: 1,
    },
  ]

  const pallets: PalletModel[] = [
    { id: 1, code: 'PLT-SEED-RACK-A2', enabled: true, acquired: true, skuId: 1, quantity: 1 },
    { id: 2, code: 'PLT-IN-0001', enabled: true, acquired: false, skuId: 1, quantity: 1 },
  ]

  const skus: SkuModel[] = [{ id: 1, code: 'SKU-001', name: 'Demo Tote', spec: 'Blue / 600x400' }]

  it('returns fallback when requested and resolved locations differ', () => {
    expect(toSelectionSourceLabel('RACK-A1', 'RACK-A2')).toBe('Fallback rule match')
    expect(toSelectionSourceLabel('RACK-A1', 'RACK-A1')).toBe('Preferred location')
  })

  it('builds an outbound order summary with fallback resolution and lock state', () => {
    const task: FlowTaskDetail = {
      id: 10,
      executableType: 1,
      flowId: 'db:outbound-basic:v1',
      acknowledged: true,
      status: 3,
      variableEntities: [
        { id: 'SourceLocationCode', value: '"RACK-A2"' },
        { id: 'SourcePalletId', value: '1' },
        { id: 'SkuCode', value: '"SKU-001"' },
      ],
      resourceDetails: [
        { id: 1, resourceType: 'Backend.Demo.Domain.Location', resourceId: '3' },
        { id: 2, resourceType: 'Backend.Demo.Domain.Pallet', resourceId: '1' },
      ],
      executableDetailModels: [],
    }

    const summary = buildOrderResourceSummary(
      'outbound',
      {
        id: 1,
        code: 'OUT-1',
        status: 3,
        destination: 'OUT-01',
        lines: [{ id: 1, skuId: 1, quantity: 1, sourceLocationId: 2 }],
      },
      task,
      locations,
      pallets,
      skus,
    )

    expect(summary?.fields.find((field) => field.label === 'Requested Location')?.value).toBe('RACK-A1')
    expect(summary?.fields.find((field) => field.label === 'Resolved Location')?.value).toBe('RACK-A2')
    expect(summary?.fields.find((field) => field.label === 'Selection Source')?.value).toBe('Fallback rule match')
    expect(summary?.fields.find((field) => field.label === 'Pallet')?.value).toBe('PLT-SEED-RACK-A2')
    expect(summary?.fields.find((field) => field.label === 'Lock State')?.value).toBe('Locked')
  })

  it('builds a retrieve execution summary with before and after resource transitions', () => {
    const task: FlowTaskDetail = {
      id: 10,
      executableType: 1,
      flowId: 'db:outbound-basic:v1',
      acknowledged: true,
      status: 3,
      variableEntities: [
        { id: 'SourceLocationCode', value: '"RACK-A2"' },
        { id: 'SourcePalletId', value: '1' },
        { id: 'SkuCode', value: '"SKU-001"' },
      ],
      resourceDetails: [
        { id: 1, resourceType: 'Backend.Demo.Domain.Location', resourceId: '3' },
        { id: 2, resourceType: 'Backend.Demo.Domain.Pallet', resourceId: '1' },
      ],
      executableDetailModels: [],
    }

    const summary = buildExecutionResourceSummary(
      task,
      { nodeId: 'Retrieve' },
      locations,
      pallets,
      skus,
    )

    expect(summary?.ruleMatch).toBeNull()
    expect(summary?.transition?.before).toContain('RACK-A2 occupied')
    expect(summary?.transition?.before).toContain('PLT-SEED-RACK-A2')
    expect(summary?.transition?.after).toContain('RACK-A2 empty')
    expect(summary?.transition?.after).toContain('pallet released')
  })

  it('builds an acquire source execution summary with rule match and fallback detail', () => {
    const task: FlowTaskDetail = {
      id: 10,
      executableType: 1,
      flowId: 'db:outbound-basic:v1',
      acknowledged: true,
      status: 3,
      variableEntities: [
        { id: 'SourceLocationCode', value: '"RACK-A2"' },
        { id: 'SourcePalletId', value: '1' },
        { id: 'SkuCode', value: '"SKU-001"' },
        { id: 'SkuId', value: '1' },
      ],
      resourceDetails: [
        { id: 1, resourceType: 'Backend.Demo.Domain.Location', resourceId: '3' },
      ],
      executableDetailModels: [],
    }

    const summary = buildExecutionResourceSummary(
      task,
      { nodeId: 'AcquireSourceLocation' },
      locations,
      pallets,
      skus,
      'RACK-A1',
    )

    expect(summary?.ruleMatch).toBe('occupied-rack-location')
    expect(summary?.transition?.before).toContain('Requested RACK-A1')
    expect(summary?.transition?.before).toContain('SKU-001')
    expect(summary?.transition?.after).toContain('Locked RACK-A2')
    expect(summary?.transition?.after).toContain('PLT-SEED-RACK-A2')
  })
})
