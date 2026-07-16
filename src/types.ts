export type OrderKind = 'inbound' | 'outbound'

export interface InboundOrderLineModel {
  id: number
  skuId: number
  quantity: number
  targetLocationId: number
}

export interface InboundOrderLineInput {
  id?: number
  skuId: number
  quantity: number
  targetLocationId: number
}

export interface OutboundOrderLineModel {
  id: number
  skuId: number
  quantity: number
  sourceLocationId: number
}

export interface OutboundOrderLineInput {
  id?: number
  skuId: number
  quantity: number
  sourceLocationId: number
}

export interface InboundOrderModel {
  id: number
  code: string
  status: number
  source: string
  flowDefinitionCode?: string | null
  flowVersionNumber?: number | null
  flowTaskId?: number | null
  remark?: string | null
  createdTime?: string | null
  updatedTime?: string | null
  completedTime?: string | null
  lines: InboundOrderLineModel[]
}

export interface CreateInboundOrderModel {
  code: string
  status?: number
  source: string
  remark?: string | null
  lines: InboundOrderLineInput[]
}

export interface OutboundOrderModel {
  id: number
  code: string
  status: number
  destination: string
  flowDefinitionCode?: string | null
  flowVersionNumber?: number | null
  flowTaskId?: number | null
  remark?: string | null
  createdTime?: string | null
  updatedTime?: string | null
  completedTime?: string | null
  lines: OutboundOrderLineModel[]
}

export interface CreateOutboundOrderModel {
  code: string
  status?: number
  destination: string
  remark?: string | null
  lines: OutboundOrderLineInput[]
}

export interface WarehouseModel {
  id: number
  code: string
  name: string
}

export interface LocationModel {
  id: number
  code: string
  name: string
  enabled: boolean
  acquired: boolean
  locationType: number
  status: number
  warehouseId: number
  currentPalletId?: number | null
}

export interface PortModel {
  id: number
  code: string
  name: string
  enabled: boolean
  acquired: boolean
  portType: number
  status: number
  warehouseId: number
  currentPalletId?: number | null
}

export interface PalletModel {
  id: number
  code: string
  enabled: boolean
  acquired: boolean
  skuId: number
  quantity: number
}

export interface SkuModel {
  id: number
  code: string
  name: string
  spec: string
}

export interface FlowDraftModel {
  code: string
  name: string
  description?: string | null
  revision: number
  draftDocumentJson: string
  updatedAt: string
  updatedBy?: string | null
}

export interface FlowDefinitionSummaryModel {
  code: string
  name: string
  description?: string | null
  status: string
  activeVersionNumber?: number | null
  activeRuntimeFlowId?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
}

export interface CreateFlowDefinitionModel {
  code: string
  name: string
  description?: string | null
}

export interface PutFlowDraftModel {
  name: string
  description?: string | null
  revision: number
  draftDocumentJson: string
}

export interface PublishFlowVersionModel {
  expectedRevision: number
}

export interface FlowVersionModel {
  id: number
  code: string
  versionNumber: number
  runtimeFlowId: string
  sourceDraftRevision: number
  sourceGraphJson: string
  compiledGraphJson: string
  simulation?: FlowSimulationModel
  publishedAt: string
  publishedBy?: string | null
  status: number
  isActive: boolean
}

export interface FlowPreflightModel {
  code: string
  sourceDraftRevision: number
  compiledGraphJson: string
  simulation: FlowSimulationModel
}

export interface FlowSimulationNodeModel {
  nodeId: string
  nodeType: string
  description?: string | null
  operationTaskType?: string | null
  flowId?: string | null
  estimatedDurationMilliseconds: number
  earliestStartMilliseconds: number
  earliestEndMilliseconds: number
  dependencyNodeIds: string[]
  isCriticalPath: boolean
}

export interface FlowSimulationModel {
  code: string
  totalDurationMilliseconds: number
  nodes: FlowSimulationNodeModel[]
}

export interface FlowDependencyPublishEntryModel {
  code: string
  revision: number
  publishOrder: number
  referencedBy: string[]
}

export interface FlowDependencyWarningModel {
  code: string
  warningCode: string
  detail: string
}

export interface FlowDependencyPublishPlanModel {
  rootCode: string
  publishOrder: FlowDependencyPublishEntryModel[]
  warnings: FlowDependencyWarningModel[]
}

export interface FlowDependencyVersionModel {
  code: string
  versionNumber: number
  runtimeFlowId: string
  sourceDraftRevision: number
}

export interface FlowDependencyPublishResultModel {
  rootCode: string
  versions: FlowDependencyVersionModel[]
}

export interface FlowDesignLocationModel {
  nodeId?: string | null
  variableId?: string | null
  field?: string | null
  pathSourceId?: string | null
}

export interface FlowDesignErrorModel {
  code: string
  errorCode: string
  detail: string
  location?: FlowDesignLocationModel | null
}

export interface OperationParameterModel {
  name: string
  typeName: string
  required: boolean
}

export interface OperationModel {
  key: string
  name: string
  description?: string | null
  category?: string | null
  estimatedDurationMilliseconds?: number | null
  operationTaskTypeName: string
  inputs: OperationParameterModel[]
  outputs: OperationParameterModel[]
  signatureHash: string
}

export interface VariableTypeModel {
  key: string
}

export interface SubFlowVariableSignatureModel {
  id: string
  type: string
}

export interface SubFlowTemplateModel {
  code: string
  name: string
  description?: string | null
  versionNumber: number
  runtimeFlowId: string
  inputs: SubFlowVariableSignatureModel[]
  outputs: SubFlowVariableSignatureModel[]
}

export interface ExpressionOperatorModel {
  key: string
  category: string
  operandCount: number
}

export interface FlowCatalogModel {
  operations: OperationModel[]
  variableTypes: VariableTypeModel[]
  subFlowTemplates: SubFlowTemplateModel[]
  expressionOperators: ExpressionOperatorModel[]
}

export type ScheduleItemKind = 0 | 1 | 2
export type SchedulePlanStatus = 0 | 1 | 2 | 3
export type SchedulePlanItemStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type ScheduleTrigger = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type ScheduleSolveAttemptStatus = 0 | 1 | 2 | 3
export type ScheduleSolverStatus = 0 | 1 | 2 | 3 | 4
export type SchedulePlanChangeKind = 0 | 1 | 2

export interface SchedulePlanModel {
  id: number
  version: number
  previousPlanId: number | null
  status: SchedulePlanStatus
  solverStatus: ScheduleSolverStatus
  trigger: ScheduleTrigger
  triggerDetail: string
  horizonStart: string
  horizonEnd: string
  createdAt: string
  committedAt: string | null
  makespan: string | null
  items: SchedulePlanItemModel[]
  latestSolveAttempt: ScheduleSolveAttemptModel | null
}

export interface SchedulePlanItemModel {
  id: number
  planId: number
  itemKind: ScheduleItemKind
  flowTaskId: number
  nodeId: string
  occurrence: number
  operationTaskId: number | null
  plannedStart: string
  plannedEnd: string
  actualStart: string | null
  actualEnd: string | null
  predictedEnd: string | null
  expectedDuration: string
  status: SchedulePlanItemStatus
  resourceType: string | null
  resourceId: string | null
  occupancyIndex: number | null
  displayLabel: string
  displayContextJson: string | null
  delayReason: string | null
  isFrozen: boolean
}

export interface ScheduleSolveAttemptModel {
  id: number
  previousPlanId: number | null
  trigger: ScheduleTrigger
  triggerDetail: string | null
  startedAt: string
  finishedAt: string | null
  status: ScheduleSolveAttemptStatus
  solverStatus: ScheduleSolverStatus
  failureReason: string | null
  candidateCount: number
}

export interface SchedulePlanComparisonModel {
  planId: number
  previousPlanId: number
  changes: SchedulePlanChangeModel[]
}

export interface SchedulePlanChangeModel {
  kind: SchedulePlanChangeKind
  currentItemId: number | null
  previousItemId: number | null
  previousStart: string | null
  currentStart: string | null
  reason: string | null
}

export interface ContentResponse<T> {
  items: T[]
}

export interface PagedResponse<T> {
  items: T[]
  totalCount: number
  pageIndex: number
  pageSize: number
  totalPages?: number
  hasPreviousPage?: boolean
  hasNextPage?: boolean
}

export type NotificationLevel = 0 | 1 | 2 | 3

export interface NotificationModel {
  id: number
  level: NotificationLevel
  source: string
  title: string
  detail?: string | null
  confirmed: boolean
  createdTime?: string | null
  confirmedTime?: string | null
}

export interface LocationInputModel {
  code: string
  name: string
  enabled: boolean
  locationType: number
  status: number
  currentPalletId?: number | null
  warehouseId: number
}

export interface PortInputModel {
  code: string
  name: string
  enabled: boolean
  portType: number
  status: number
  currentPalletId?: number | null
  warehouseId: number
}

export interface PalletInputModel {
  code: string
  enabled: boolean
  skuId: number
  quantity: number
}

export interface SkuInputModel {
  code: string
  name: string
  spec: string
}

export type InboundOrderNoOpSearchContext = Record<string, never>
export type OutboundOrderNoOpSearchContext = Record<string, never>

export interface VariableEntityModel {
  id: string
  value?: string | null
}

export interface ResourceDetailModel {
  id?: string | number
  resourceType?: string | null
  resourceId?: string | null
}

export interface ResourceSummaryField {
  label: string
  value: string
}

export interface ExecutionResourceTransition {
  before?: string | null
  after?: string | null
}

export interface ResourceSummaryCard {
  title: string
  fields: ResourceSummaryField[]
  ruleMatch?: string | null
  transition?: ExecutionResourceTransition | null
}

export interface ExecutableDetailModel {
  executableType: number
  id: number
  parentFlowTaskId?: number | null
  nodeId?: string | null
  availableActions?: string[]
  acknowledged: boolean
  status: number
  errorMessage?: string | null
  stackTrace?: string | null
  scheduledTime?: string | null
  startingTime?: string | null
  finishedTime?: string | null
}

export interface OperationTaskDetailModel extends ExecutableDetailModel {
  operationTaskType?: string | null
  consoleId?: string | null
  customProperties?: string | null
}

export interface FlowTaskDetail extends ExecutableDetailModel {
  id: number
  flowId: string
  executionOptionsDetail?: string | null
  variableEntities?: VariableEntityModel[]
  resourceDetails?: ResourceDetailModel[]
  executableDetailModels?: ExecutableDetailModel[]
}

export interface DraftVariable {
  id: string
  type: string
  usage: 'input' | 'output' | 'inputOutput'
  initialValue: string | number | boolean
}

export interface DraftBinding {
  source: string
  destination: string
}

export interface DraftNode {
  id: string
  nodeType: 'Operation' | 'SubFlow'
  description?: string
  estimatedDurationMilliseconds?: number | null
  shouldThrowOnFailed: boolean
  shouldThrowOnCanceled: boolean
  inputs: DraftBinding[]
  outputs: DraftBinding[]
  resourceOutputs: { source: string; resourceType: string }[]
  consoleId?: string
  operationTaskType?: string
  flowId?: string
}

export interface DraftRoute {
  type: number
  source: string
  targets: string[]
  caseValues?: number[] | null
  kind: number
  condition?: string | null
}

export interface DraftDocument {
  id: string
  variables: DraftVariable[]
  nodes: DraftNode[]
  routes: DraftRoute[]
  editorState?: {
    viewport?: { x: number; y: number; zoom: number }
  }
}
