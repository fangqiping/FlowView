import { EDITOR_VARIABLE_TYPES, LOCAL_OPERATION_LIBRARY } from './flowDraft'
import type { FlowCatalogModel } from '../types'

export function getVisibleSubFlowTemplates(catalog: FlowCatalogModel, currentCode?: string | null) {
  return catalog.subFlowTemplates.filter((template) => template.code !== currentCode)
}

export function buildCatalogSummary(catalog: FlowCatalogModel, currentCode?: string | null) {
  return {
    operations: LOCAL_OPERATION_LIBRARY.length,
    subflows: getVisibleSubFlowTemplates(catalog, currentCode).length,
    variableTypes: EDITOR_VARIABLE_TYPES.length,
  }
}
