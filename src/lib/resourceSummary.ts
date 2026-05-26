import type {
  FlowTaskDetail,
  InboundOrderModel,
  LocationModel,
  OrderKind,
  OutboundOrderModel,
  PalletModel,
  ResourceSummaryCard,
  ResourceSummaryField,
  SkuModel,
} from '../types'

type OrderModel = InboundOrderModel | OutboundOrderModel

export function toSelectionSourceLabel(requestedLocation?: string | null, resolvedLocation?: string | null) {
  if (!requestedLocation || !resolvedLocation) {
    return ''
  }

  return requestedLocation === resolvedLocation ? 'Preferred location' : 'Fallback rule match'
}

export function buildOrderResourceSummary(
  kind: OrderKind,
  order: OrderModel | null,
  task: FlowTaskDetail | null,
  locations: LocationModel[],
  pallets: PalletModel[],
  skus: SkuModel[],
): ResourceSummaryCard | null {
  if (!order || !task) {
    return null
  }

  const line = order.lines[0]
  if (!line) {
    return null
  }

  const requestedLocationId = kind === 'inbound'
    ? (line as InboundOrderModel['lines'][number]).targetLocationId
    : (line as OutboundOrderModel['lines'][number]).sourceLocationId
  const requestedLocation = locations.find((location) => location.id === requestedLocationId) ?? null
  const resolvedLocationCode = readStringVariable(task, kind === 'inbound' ? 'TargetLocationCode' : 'SourceLocationCode')
  const resolvedLocation = findLocationByCode(locations, resolvedLocationCode)
  const palletId = kind === 'inbound'
    ? readNumberVariable(task, 'InboundPalletId') ?? resolvedLocation?.currentPalletId ?? null
    : readNumberVariable(task, 'SourcePalletId')
  const pallet = palletId != null ? pallets.find((item) => item.id === palletId) ?? null : null
  const skuCode = readStringVariable(task, 'SkuCode')
  const palletCode = kind === 'inbound'
    ? readStringVariable(task, 'InboundPalletCode') ?? pallet?.code ?? null
    : pallet?.code ?? null
  const sku = skuCode
    ? skus.find((item) => item.code === skuCode) ?? null
    : pallet
      ? skus.find((item) => item.id === pallet.skuId) ?? null
      : null
  const lockedResourceIds = getLockedResourceIds(task)

  const fields: ResourceSummaryField[] = [
    { label: 'Requested Location', value: requestedLocation?.code ?? 'Unknown' },
    { label: 'Resolved Location', value: resolvedLocation?.code ?? resolvedLocationCode ?? 'Unknown' },
    { label: 'Location Status', value: resolvedLocation ? toLocationStatusLabel(resolvedLocation.status) : 'Unknown' },
    { label: 'Pallet', value: palletCode ?? (palletId ? `Pallet #${palletId}` : 'None') },
    { label: 'SKU', value: sku?.code ?? skuCode ?? 'Unknown' },
    {
      label: 'Lock State',
      value: resolvedLocation && lockedResourceIds.has(`location:${resolvedLocation.id}`) ? 'Locked' : 'Unlocked',
    },
  ]

  const selectionSource = toSelectionSourceLabel(requestedLocation?.code, resolvedLocation?.code ?? resolvedLocationCode)
  if (selectionSource) {
    fields.push({ label: 'Selection Source', value: selectionSource })
  }

  return {
    title: 'Warehouse Resources',
    fields,
  }
}

export function buildExecutionResourceSummary(
  task: FlowTaskDetail | null,
  selectedNode: { nodeId?: string | null } | null,
  locations: LocationModel[],
  pallets: PalletModel[],
  skus: SkuModel[],
  requestedLocationCode?: string | null,
): ResourceSummaryCard | null {
  if (!task || !selectedNode?.nodeId) {
    return null
  }

  const nodeId = selectedNode.nodeId
  const isInbound = task.flowId.includes('inbound')
  const effectiveRequestedLocationCode = requestedLocationCode
    ?? readStringVariable(task, isInbound ? 'RequestedTargetLocationCode' : 'RequestedSourceLocationCode')
    ?? null
  const resolvedLocationCode = readStringVariable(task, isInbound ? 'TargetLocationCode' : 'SourceLocationCode')
  const resolvedLocation = findLocationByCode(locations, resolvedLocationCode)
  const palletId = isInbound
    ? readNumberVariable(task, 'InboundPalletId') ?? resolvedLocation?.currentPalletId ?? null
    : readNumberVariable(task, 'SourcePalletId')
  const pallet = palletId != null ? pallets.find((item) => item.id === palletId) ?? null : null
  const skuCode = readStringVariable(task, 'SkuCode')
  const palletCode = isInbound
    ? readStringVariable(task, 'InboundPalletCode') ?? pallet?.code ?? null
    : pallet?.code ?? null
  const sku = skuCode
    ? skus.find((item) => item.code === skuCode) ?? null
    : pallet
      ? skus.find((item) => item.id === pallet.skuId) ?? null
      : null
  const lockedResourceIds = getLockedResourceIds(task)

  const fields: ResourceSummaryField[] = []
  const resolvedLocationLabel = resolvedLocation?.code ?? resolvedLocationCode ?? 'Unknown'
  if (effectiveRequestedLocationCode) {
    fields.push({ label: 'Requested Location', value: effectiveRequestedLocationCode })
  }
  fields.push(
    { label: 'Resolved Location', value: resolvedLocationLabel },
    { label: 'Location Status', value: resolvedLocation ? toLocationStatusLabel(resolvedLocation.status) : 'Unknown' },
    { label: 'Pallet', value: palletCode ?? (palletId ? `Pallet #${palletId}` : 'None') },
    { label: 'SKU', value: sku?.code ?? skuCode ?? 'Unknown' },
    {
      label: 'Lock State',
      value: resolvedLocation && lockedResourceIds.has(`location:${resolvedLocation.id}`) ? 'Locked' : 'Unlocked',
    },
  )

  const ruleMatch = toRuleMatchLabel(nodeId)
  const transition = toTransition(nodeId, {
    requestedLocationCode: effectiveRequestedLocationCode,
    resolvedLocationCode: resolvedLocation?.code ?? resolvedLocationCode ?? null,
    palletCode,
    skuCode: sku?.code ?? skuCode ?? null,
  })

  if (!ruleMatch && !transition.before && !transition.after) {
    return null
  }

  return {
    title: 'Warehouse Resources',
    fields,
    ruleMatch,
    transition,
  }
}

function readTaskVariable(task: FlowTaskDetail | null, id: string) {
  return task?.variableEntities?.find((variable) => variable.id === id)?.value ?? null
}

function readStringVariable(task: FlowTaskDetail | null, id: string) {
  const value = readTaskVariable(task, id)
  if (!value) {
    return null
  }

  if (value.startsWith('"')) {
    try {
      return JSON.parse(value) as string
    } catch {
      return value.replaceAll('"', '')
    }
  }

  return value
}

function readNumberVariable(task: FlowTaskDetail | null, id: string) {
  const value = readTaskVariable(task, id)
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function findLocationByCode(locations: LocationModel[], code?: string | null) {
  if (!code) {
    return null
  }

  return locations.find((location) => location.code === code) ?? null
}

function getLockedResourceIds(task: FlowTaskDetail | null) {
  const locked = new Set<string>()
  for (const detail of task?.resourceDetails ?? []) {
    if (!detail.resourceId) {
      continue
    }

    const type = detail.resourceType?.toLowerCase() ?? ''
    if (type.includes('pallet')) {
      locked.add(`pallet:${detail.resourceId}`)
    } else {
      locked.add(`location:${detail.resourceId}`)
    }
  }
  return locked
}

function toLocationStatusLabel(status: number) {
  switch (status) {
    case 0:
      return 'Available'
    case 1:
      return 'Empty'
    case 2:
      return 'Occupied'
    default:
      return `Status ${status}`
  }
}

function toRuleMatchLabel(nodeId: string) {
  switch (nodeId) {
    case 'AcquireTargetLocation':
      return 'empty-rack-location'
    case 'AcquireSourceLocation':
      return 'occupied-rack-location'
    default:
      return null
  }
}

function toTransition(
  nodeId: string,
  context: {
    requestedLocationCode: string | null
    resolvedLocationCode: string | null
    palletCode: string | null
    skuCode: string | null
  },
) {
  switch (nodeId) {
    case 'AcquireTargetLocation':
      return {
        before: context.requestedLocationCode ? `Requested ${context.requestedLocationCode}` : undefined,
        after: context.resolvedLocationCode
          ? `Locked ${context.resolvedLocationCode}${
              context.requestedLocationCode && context.requestedLocationCode !== context.resolvedLocationCode
                ? ' (fallback)'
                : ''
            }`
          : undefined,
      }
    case 'AcquireSourceLocation':
      return {
        before: [
          context.requestedLocationCode ? `Requested ${context.requestedLocationCode}` : null,
          context.skuCode ? `for ${context.skuCode}` : null,
        ].filter(Boolean).join(' '),
        after: [
          context.resolvedLocationCode ? `Locked ${context.resolvedLocationCode}` : null,
          context.palletCode ? `with pallet ${context.palletCode}` : null,
        ].filter(Boolean).join(' '),
      }
    case 'Store':
      return {
        before: context.resolvedLocationCode ? `${context.resolvedLocationCode} empty` : 'Target location empty',
        after: context.resolvedLocationCode ? `${context.resolvedLocationCode} occupied, pallet created` : 'Location occupied, pallet created',
      }
    case 'Retrieve':
      return {
        before: [
          context.resolvedLocationCode ? `${context.resolvedLocationCode} occupied` : null,
          context.palletCode ? `with pallet ${context.palletCode}` : 'pallet bound',
        ].filter(Boolean).join(', '),
        after: context.resolvedLocationCode ? `${context.resolvedLocationCode} empty, pallet released` : 'Location empty, pallet released',
      }
    case 'BindLocationPallet':
      return {
        before: context.resolvedLocationCode ? `${context.resolvedLocationCode} empty` : 'Target location empty',
        after: [
          context.resolvedLocationCode ? `${context.resolvedLocationCode} occupied` : 'Location occupied',
          context.palletCode ? `pallet ${context.palletCode} bound` : 'pallet bound',
        ].join(', '),
      }
    default:
      return {
        before: undefined,
        after: undefined,
      }
  }
}
