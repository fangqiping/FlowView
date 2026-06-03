import type { FlowCatalogModel, FlowDraftModel } from '../types'
import { parseDraftDocument } from './flowDraft'

export function getVisibleSubFlowTemplates(catalog: FlowCatalogModel, currentCode?: string | null) {
  return catalog.subFlowTemplates.filter((template) => template.code !== currentCode)
}

export function buildDraftGraphSummary(draft: FlowDraftModel) {
  const document = parseDraftDocument(draft.draftDocumentJson, draft.code)

  return {
    operations: document.nodes.filter((node) => node.nodeType === 'Operation').length,
    subflows: document.nodes.filter((node) => node.nodeType === 'SubFlow').length,
    variables: document.variables.length,
  }
}
