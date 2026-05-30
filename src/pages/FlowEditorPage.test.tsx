import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { FlowEditorPage } from './FlowEditorPage'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    api: {
      getFlowDraft: vi.fn(),
      getFlowCatalog: vi.fn(),
      getFlowDefinitions: vi.fn(),
      saveFlowDraft: vi.fn(),
      preflightFlow: vi.fn(),
      publishFlow: vi.fn(),
      preflightFlowWithDependencies: vi.fn(),
      publishFlowWithDependencies: vi.fn(),
    },
  }
})

describe('FlowEditorPage subflows', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows subflow signatures in the inspector', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([
      {
        code: 'child-flow',
        name: 'Child Flow',
        status: 'Active',
        activeVersionNumber: 1,
        activeRuntimeFlowId: 'db:child-flow:v1',
        createdAt: '',
        updatedAt: '',
      },
    ])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      variableTypes: [],
      expressionOperators: [],
      subFlowTemplates: [
        {
          code: 'child-flow',
          name: 'Child Flow',
          versionNumber: 1,
          runtimeFlowId: 'db:child-flow:v1',
          inputs: [{ id: 'OrderCode', type: 'string' }],
          outputs: [{ id: 'Status', type: 'string' }],
        },
      ],
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'parent-flow',
      name: 'Parent Flow',
      revision: 1,
      updatedAt: '',
      draftDocumentJson: JSON.stringify({
        id: 'ParentFlow',
        variables: [
          { id: 'OrderCode', type: 'string', usage: 'input', initialValue: '' },
          { id: 'Status', type: 'string', usage: 'output', initialValue: '' },
        ],
        nodes: [
          {
            id: 'InvokeChild',
            nodeType: 'SubFlow',
            flowId: 'child-flow',
            inputs: [{ source: 'OrderCode', destination: 'OrderCode' }],
            outputs: [{ source: 'Status', destination: 'Status' }],
            resourceOutputs: [],
          },
        ],
        routes: [],
      }),
    })

    renderEditor()

    expect(await screen.findByText('Child Flow')).toBeTruthy()
    expect(screen.getAllByText('OrderCode').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /open subflow/i })).toBeTruthy()
  })

  it('adds subflow nodes with child code references', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([
      {
        code: 'child-flow',
        name: 'Child Flow',
        status: 'Active',
        activeVersionNumber: 1,
        activeRuntimeFlowId: 'db:child-flow:v1',
        createdAt: '',
        updatedAt: '',
      },
    ])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      variableTypes: [],
      expressionOperators: [],
      subFlowTemplates: [
        {
          code: 'child-flow',
          name: 'Child Flow',
          versionNumber: 1,
          runtimeFlowId: 'db:child-flow:v1',
          inputs: [],
          outputs: [],
        },
      ],
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'parent-flow',
      name: 'Parent Flow',
      revision: 1,
      updatedAt: '',
      draftDocumentJson: JSON.stringify({ id: 'ParentFlow', variables: [], nodes: [], routes: [] }),
    })
    vi.mocked(api.saveFlowDraft).mockResolvedValue({
      code: 'parent-flow',
      name: 'Parent Flow',
      revision: 2,
      updatedAt: '',
      draftDocumentJson: '{}',
    })

    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: /child flow/i }))
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => expect(api.saveFlowDraft).toHaveBeenCalled())
    const saveInput = vi.mocked(api.saveFlowDraft).mock.calls[0][1]
    expect(saveInput.draftDocumentJson).toContain('"flowId":"child-flow"')
    expect(saveInput.draftDocumentJson).not.toContain('db:child-flow:v1')
  })

  it('preflights and publishes with subflows', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      subFlowTemplates: [],
      variableTypes: [],
      expressionOperators: [],
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'parent-flow',
      name: 'Parent Flow',
      revision: 5,
      updatedAt: '',
      draftDocumentJson: JSON.stringify({ id: 'ParentFlow', variables: [], nodes: [], routes: [] }),
    })
    vi.mocked(api.preflightFlowWithDependencies).mockResolvedValue({
      rootCode: 'parent-flow',
      publishOrder: [
        { code: 'child-flow', revision: 2, publishOrder: 1, referencedBy: ['parent-flow'] },
        { code: 'parent-flow', revision: 5, publishOrder: 2, referencedBy: [] },
      ],
      warnings: [],
    })
    vi.mocked(api.publishFlowWithDependencies).mockResolvedValue({
      rootCode: 'parent-flow',
      versions: [
        { code: 'child-flow', versionNumber: 3, runtimeFlowId: 'db:child-flow:v3', sourceDraftRevision: 2 },
        { code: 'parent-flow', versionNumber: 6, runtimeFlowId: 'db:parent-flow:v6', sourceDraftRevision: 5 },
      ],
    })

    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: /publish with subflows/i }))
    expect(await screen.findByText(/child-flow r2/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /confirm publish/i }))

    expect(api.preflightFlowWithDependencies).toHaveBeenCalledWith('parent-flow', 5)
    expect(api.publishFlowWithDependencies).toHaveBeenCalledWith('parent-flow', 5)
    expect(await screen.findByText(/published child-flow v3, parent-flow v6/i)).toBeTruthy()
  })
})

function renderEditor() {
  render(
    <MemoryRouter initialEntries={['/flows/parent-flow/editor']}>
      <Routes>
        <Route path="/flows/:code/editor" element={<FlowEditorPage />} />
      </Routes>
    </MemoryRouter>,
  )
}
