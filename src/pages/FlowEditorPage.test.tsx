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
