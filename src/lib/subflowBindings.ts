import type {
  DraftBinding,
  FlowCatalogModel,
  FlowDefinitionSummaryModel,
  SubFlowVariableSignatureModel,
} from '../types'

export interface SubFlowCandidate {
  code: string
  name: string
  description?: string | null
  activeVersionNumber?: number | null
  activeRuntimeFlowId?: string | null
  inputs: SubFlowVariableSignatureModel[]
  outputs: SubFlowVariableSignatureModel[]
}

export function findSubFlowCandidate(
  code: string,
  definitions: FlowDefinitionSummaryModel[],
  catalog: FlowCatalogModel | null,
): SubFlowCandidate | null {
  const definition = definitions.find((item) => item.code === code)
  if (!definition) {
    return null
  }

  const template = catalog?.subFlowTemplates.find((item) => item.code === code)
  return {
    code: definition.code,
    name: template?.name ?? definition.name,
    description: template?.description ?? definition.description,
    activeVersionNumber: template?.versionNumber ?? definition.activeVersionNumber,
    activeRuntimeFlowId: template?.runtimeFlowId ?? definition.activeRuntimeFlowId,
    inputs: template?.inputs ?? [],
    outputs: template?.outputs ?? [],
  }
}

export function buildSubFlowInputBindings(
  inputs: SubFlowVariableSignatureModel[],
  parentVariableByChildVariable: Record<string, string>,
): DraftBinding[] {
  return inputs.map((input) => ({
    source: parentVariableByChildVariable[input.id] ?? input.id,
    destination: input.id,
  }))
}

export function buildSubFlowOutputBindings(
  outputs: SubFlowVariableSignatureModel[],
  parentVariableByChildVariable: Record<string, string>,
): DraftBinding[] {
  return outputs.map((output) => ({
    source: output.id,
    destination: parentVariableByChildVariable[output.id] ?? output.id,
  }))
}
