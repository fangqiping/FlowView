import { createRouteEdge, type FlowEdge, type RouteKind } from './flowDraft'

export type OutgoingRouteMode = RouteKind

export interface OutgoingRouteState {
  mode: OutgoingRouteMode
  condition: string
  directTargets: string[]
  trueTarget: string
  falseTarget: string
  switchTargets: string[]
}

export function emptyOutgoingRoute(mode: OutgoingRouteMode = 'direct'): OutgoingRouteState {
  return {
    mode,
    condition: '',
    directTargets: [],
    trueTarget: '',
    falseTarget: '',
    switchTargets: [],
  }
}

export function getOutgoingRoute(edges: FlowEdge[], sourceId: string): OutgoingRouteState {
  const outgoing = edges
    .filter((edge) => edge.source === sourceId)
    .sort((left, right) => (left.data?.routeTargetIndex ?? 0) - (right.data?.routeTargetIndex ?? 0))

  if (outgoing.length === 0) {
    return emptyOutgoingRoute()
  }

  const first = outgoing[0]
  const mode = first.data?.routeKind ?? 'direct'
  const condition = first.data?.routeCondition ?? ''

  if (mode === 'condition') {
    return {
      mode,
      condition,
      directTargets: [],
      trueTarget: outgoing[0]?.target ?? '',
      falseTarget: outgoing[1]?.target ?? '',
      switchTargets: [],
    }
  }

  if (mode === 'switch') {
    return {
      mode,
      condition,
      directTargets: [],
      trueTarget: '',
      falseTarget: '',
      switchTargets: outgoing.map((edge) => edge.target),
    }
  }

  return {
    mode: 'direct',
    condition: '',
    directTargets: outgoing.map((edge) => edge.target),
    trueTarget: '',
    falseTarget: '',
    switchTargets: [],
  }
}

export function replaceOutgoingRoute(edges: FlowEdge[], sourceId: string, route: OutgoingRouteState): FlowEdge[] {
  const retained = edges.filter((edge) => edge.source !== sourceId)
  return [
    ...retained,
    ...createOutgoingEdges(sourceId, route),
  ]
}

function createOutgoingEdges(sourceId: string, route: OutgoingRouteState): FlowEdge[] {
  if (route.mode === 'condition') {
    return [route.trueTarget, route.falseTarget]
      .filter(Boolean)
      .map((target, index) => createRouteEdge(sourceId, target, 'condition', index, route.condition))
  }

  if (route.mode === 'switch') {
    return route.switchTargets
      .filter(Boolean)
      .map((target, index) => createRouteEdge(sourceId, target, 'switch', index, route.condition))
  }

  return route.directTargets
    .filter(Boolean)
    .map((target, index) => createRouteEdge(sourceId, target, 'direct', index))
}
