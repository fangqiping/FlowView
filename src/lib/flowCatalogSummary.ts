import { EDITOR_VARIABLE_TYPES, LOCAL_OPERATION_LIBRARY } from './flowDraft'
import type { FlowCatalogModel } from '../types'

export function buildCatalogSummary(catalog: FlowCatalogModel) {
  return {
    operations: LOCAL_OPERATION_LIBRARY.length,
    subflows: catalog.subFlowTemplates.length,
    variableTypes: EDITOR_VARIABLE_TYPES.length,
  }
}
