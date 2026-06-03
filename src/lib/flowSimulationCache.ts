import type { FlowSimulationModel } from '../types'

const STORAGE_PREFIX = 'flowview.simulation.'

export function saveFlowSimulation(code: string, simulation: FlowSimulationModel) {
  sessionStorage.setItem(storageKey(code), JSON.stringify(simulation))
}

export function loadFlowSimulation(code: string): FlowSimulationModel | null {
  const raw = sessionStorage.getItem(storageKey(code))
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FlowSimulationModel>
    if (!parsed.code || !Array.isArray(parsed.nodes) || typeof parsed.totalDurationMilliseconds !== 'number') {
      return null
    }

    return parsed as FlowSimulationModel
  } catch {
    return null
  }
}

export function clearFlowSimulation(code: string) {
  sessionStorage.removeItem(storageKey(code))
}

function storageKey(code: string) {
  return `${STORAGE_PREFIX}${code}`
}
