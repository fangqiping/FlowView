import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(payload),
  } as Response
}

describe('api flow definition client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads flow definitions from the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    await api.getFlowDefinitions()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:5086/api/FlowDefinitions',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('creates a flow definition', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code: 'child-flow' }))
    vi.stubGlobal('fetch', fetchMock)

    await api.createFlowDefinition({ code: 'child-flow', name: 'Child Flow' })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:5086/api/FlowDefinitions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'child-flow', name: 'Child Flow' }),
      }),
    )
  })

  it('preflights a flow with dependencies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ publishOrder: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await api.preflightFlowWithDependencies('parent-flow', 3)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:5086/api/FlowDefinitions/parent-flow/PreflightWithDependencies',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expectedRevision: 3 }),
      }),
    )
  })

  it('publishes a flow with dependencies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ versions: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await api.publishFlowWithDependencies('parent-flow', 3)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:5086/api/FlowDefinitions/parent-flow/PublishWithDependencies',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expectedRevision: 3 }),
      }),
    )
  })
})
