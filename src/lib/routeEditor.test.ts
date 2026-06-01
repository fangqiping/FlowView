import { describe, expect, it } from 'vitest'
import { createRouteEdge } from './flowDraft'
import { getOutgoingRoute, replaceOutgoingRoute } from './routeEditor'

describe('routeEditor', () => {
  it('reads condition outgoing routes from edge metadata', () => {
    const route = getOutgoingRoute([
      createRouteEdge('CheckInventory', 'StorePallet', 'condition', 0, 'CanStore'),
      createRouteEdge('CheckInventory', 'RejectPallet', 'condition', 1, 'CanStore'),
      createRouteEdge('OtherNode', 'StorePallet', 'direct', 0),
    ], 'CheckInventory')

    expect(route).toEqual({
      mode: 'condition',
      condition: 'CanStore',
      directTargets: [],
      trueTarget: 'StorePallet',
      falseTarget: 'RejectPallet',
      switchTargets: [],
      switchCaseValues: [],
    })
  })

  it('replaces one node outgoing route without touching other sources', () => {
    const edges = replaceOutgoingRoute([
      createRouteEdge('CheckInventory', 'OldTarget', 'direct', 0),
      createRouteEdge('OtherNode', 'StorePallet', 'direct', 0),
    ], 'CheckInventory', {
      mode: 'switch',
      condition: 'BranchIndex',
      directTargets: [],
      trueTarget: '',
      falseTarget: '',
      switchTargets: ['ManualReview', 'RejectPallet'],
      switchCaseValues: ['2', '7'],
    })

    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'OtherNode', target: 'StorePallet' }),
      expect.objectContaining({ source: 'CheckInventory', target: 'ManualReview', label: 'BranchIndex: 2' }),
      expect.objectContaining({ source: 'CheckInventory', target: 'RejectPallet', label: 'BranchIndex: 7' }),
    ]))
    expect(edges.some((edge) => edge.target === 'OldTarget')).toBe(false)
  })
})
