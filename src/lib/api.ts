import type {
  ContentResponse,
  CreateFlowDefinitionModel,
  CreateInboundOrderModel,
  CreateOutboundOrderModel,
  FlowCatalogModel,
  FlowDesignErrorModel,
  FlowDefinitionSummaryModel,
  FlowDependencyPublishPlanModel,
  FlowDependencyPublishResultModel,
  FlowDraftModel,
  FlowPreflightModel,
  FlowTaskDetail,
  FlowVersionModel,
  InboundOrderModel,
  LocationModel,
  LocationInputModel,
  OrderKind,
  OutboundOrderModel,
  PublishFlowVersionModel,
  PutFlowDraftModel,
  PalletModel,
  PalletInputModel,
  PagedResponse,
  PortModel,
  PortInputModel,
  SkuModel,
  SkuInputModel,
  WarehouseModel,
} from '../types'
import type { SupportedLanguage } from '../i18n/languages'
import { buildPaginationQuery } from './masterData'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5086'

let apiLanguage: SupportedLanguage = 'en-US'

export function setApiLanguage(language: SupportedLanguage) {
  apiLanguage = language
}

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {})
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Accept-Language', apiLanguage)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(`${response.status} ${response.statusText}`, response.status, payload)
  }

  return payload as T
}

export const api = {
  async getInboundOrders() {
    return request<ContentResponse<InboundOrderModel>>('/api/InboundOrders?ShouldPaginate=false')
  },

  async getOutboundOrders() {
    return request<ContentResponse<OutboundOrderModel>>('/api/OutboundOrders?ShouldPaginate=false')
  },

  async getInboundOrder(id: number) {
    return request<InboundOrderModel>(`/api/InboundOrders/${id}`)
  },

  async getOutboundOrder(id: number) {
    return request<OutboundOrderModel>(`/api/OutboundOrders/${id}`)
  },

  async getWarehouses() {
    return request<ContentResponse<WarehouseModel>>('/api/Warehouses?ShouldPaginate=false')
  },

  async createInboundOrder(input: CreateInboundOrderModel) {
    return request<InboundOrderModel>('/api/InboundOrders', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async createOutboundOrder(input: CreateOutboundOrderModel) {
    return request<OutboundOrderModel>('/api/OutboundOrders', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async orderAction(kind: OrderKind, id: number, action: 'submit' | 'start-flow' | 'complete' | 'cancel') {
    const prefix = kind === 'inbound' ? 'InboundOrders' : 'OutboundOrders'
    return request<InboundOrderModel | OutboundOrderModel>(`/api/${prefix}/${id}/${action}`, {
      method: 'POST',
    })
  },

  async getSkus() {
    return request<ContentResponse<SkuModel>>('/api/Skus?ShouldPaginate=false')
  },

  async getSkusPage(pageIndex: number, pageSize: number) {
    return request<PagedResponse<SkuModel>>(`/api/Skus${buildPaginationQuery({ pageIndex, pageSize })}`)
  },

  async createSku(input: SkuInputModel) {
    return request<SkuModel>('/api/Skus', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async updateSku(id: number, input: SkuInputModel) {
    return request<SkuModel>(`/api/Skus/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },

  async deleteSku(id: number) {
    return request<void>(`/api/Skus/${id}`, {
      method: 'DELETE',
    })
  },

  async getLocations() {
    return request<ContentResponse<LocationModel>>('/api/Locations?ShouldPaginate=false')
  },

  async getLocationsPage(pageIndex: number, pageSize: number) {
    return request<PagedResponse<LocationModel>>(`/api/Locations${buildPaginationQuery({ pageIndex, pageSize })}`)
  },

  async createLocation(input: LocationInputModel) {
    return request<LocationModel>('/api/Locations', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async updateLocation(id: number, input: LocationInputModel) {
    return request<LocationModel>(`/api/Locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },

  async deleteLocation(id: number) {
    return request<void>(`/api/Locations/${id}`, {
      method: 'DELETE',
    })
  },

  async getPorts() {
    return request<ContentResponse<PortModel>>('/api/Ports?ShouldPaginate=false')
  },

  async getPortsPage(pageIndex: number, pageSize: number) {
    return request<PagedResponse<PortModel>>(`/api/Ports${buildPaginationQuery({ pageIndex, pageSize })}`)
  },

  async createPort(input: PortInputModel) {
    return request<PortModel>('/api/Ports', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async updatePort(id: number, input: PortInputModel) {
    return request<PortModel>(`/api/Ports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },

  async deletePort(id: number) {
    return request<void>(`/api/Ports/${id}`, {
      method: 'DELETE',
    })
  },

  async getPallets() {
    return request<ContentResponse<PalletModel>>('/api/Pallets?ShouldPaginate=false')
  },

  async getPalletsPage(pageIndex: number, pageSize: number) {
    return request<PagedResponse<PalletModel>>(`/api/Pallets${buildPaginationQuery({ pageIndex, pageSize })}`)
  },

  async createPallet(input: PalletInputModel) {
    return request<PalletModel>('/api/Pallets', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async updatePallet(id: number, input: PalletInputModel) {
    return request<PalletModel>(`/api/Pallets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },

  async deletePallet(id: number) {
    return request<void>(`/api/Pallets/${id}`, {
      method: 'DELETE',
    })
  },

  async getFlowCatalog() {
    return request<FlowCatalogModel>('/api/FlowCatalog')
  },

  async getFlowDefinitions() {
    return request<FlowDefinitionSummaryModel[]>('/api/FlowDefinitions')
  },

  async createFlowDefinition(input: CreateFlowDefinitionModel) {
    return request<FlowDraftModel>('/api/FlowDefinitions', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async getFlowDraft(code: string) {
    return request<FlowDraftModel>(`/api/FlowDefinitions/${code}/Draft`)
  },

  async saveFlowDraft(code: string, input: PutFlowDraftModel) {
    return request<FlowDraftModel>(`/api/FlowDefinitions/${code}/Draft`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },

  async preflightFlow(code: string, expectedRevision: number) {
    return request<FlowPreflightModel>(`/api/FlowDefinitions/${code}/Preflight`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision }),
    })
  },

  async preflightFlowWithDependencies(code: string, expectedRevision: number) {
    return request<FlowDependencyPublishPlanModel>(`/api/FlowDefinitions/${code}/PreflightWithDependencies`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision }),
    })
  },

  async publishFlow(code: string, input: PublishFlowVersionModel) {
    return request<FlowVersionModel>(`/api/FlowDefinitions/${code}/Publish`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async publishFlowWithDependencies(code: string, expectedRevision: number) {
    return request<FlowDependencyPublishResultModel>(`/api/FlowDefinitions/${code}/PublishWithDependencies`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision }),
    })
  },

  async getFlowVersions(code: string) {
    return request<FlowVersionModel[]>(`/api/FlowDefinitions/${code}/Versions`)
  },

  async activateFlowVersion(code: string, versionNumber: number) {
    return request<FlowVersionModel>(
      `/api/FlowDefinitions/${code}/Versions/${versionNumber}/Activate`,
      { method: 'POST' },
    )
  },

  async getFlowTask(id: number) {
    return request<FlowTaskDetail>(`/api/FlowTask/${id}`)
  },

  async flowTaskAction(id: number, action: 'cancel' | 'skip' | 'restart') {
    return request<void>(`/api/FlowTask/${toActionSegment(action)}/${id}`, {
      method: 'POST',
    })
  },

  async operationTaskAction(id: number, action: 'cancel' | 'skip' | 'restart') {
    return request<void>(`/api/OperationTask/${toActionSegment(action)}/${id}`, {
      method: 'POST',
    })
  },
}

function toActionSegment(action: 'cancel' | 'skip' | 'restart') {
  switch (action) {
    case 'cancel':
      return 'Cancel'
    case 'skip':
      return 'Skip'
    case 'restart':
      return 'Restart'
  }
}

export function extractDesignError(error: unknown): FlowDesignErrorModel | null {
  if (!(error instanceof ApiError) || !error.payload) {
    return null
  }

  const payload = error.payload as Record<string, unknown>
  if (typeof payload.errorCode === 'string' && typeof payload.detail === 'string') {
    return payload as unknown as FlowDesignErrorModel
  }

  return null
}
