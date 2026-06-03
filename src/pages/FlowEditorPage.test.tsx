import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
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
    localStorage.clear()
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

  it('loads backend catalog operations into grouped node library', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [
        {
          key: 'backend-move',
          name: 'Backend Move',
          description: 'Move with backend template metadata.',
          category: 'FunctionConsole',
          operationTaskTypeName: 'Backend.Demo.BackendMoveOperationTask',
          inputs: [{ name: 'OrderCode', typeName: 'System.String', required: true }],
          outputs: [{ name: 'Status', typeName: 'System.String', required: false }],
          signatureHash: 'backend-move-v1',
        },
      ],
      variableTypes: [],
      expressionOperators: [],
      subFlowTemplates: [],
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

    expect(await screen.findByText('FunctionConsole')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /backend move/i }))
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => expect(api.saveFlowDraft).toHaveBeenCalled())
    const saveInput = vi.mocked(api.saveFlowDraft).mock.calls[0][1]
    const savedDocument = JSON.parse(saveInput.draftDocumentJson)
    expect(savedDocument.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeType: 'Operation',
        consoleId: 'FunctionConsole',
        operationTaskType: 'Backend.Demo.BackendMoveOperationTask',
        inputs: [{ source: 'OrderCode', destination: 'OrderCode' }],
        outputs: [{ source: 'Status', destination: 'Status' }],
      }),
    ]))
  })

  it('shows built-in console groups from local fallback templates', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      variableTypes: [],
      expressionOperators: [],
      subFlowTemplates: [],
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'parent-flow',
      name: 'Parent Flow',
      revision: 1,
      updatedAt: '',
      draftDocumentJson: JSON.stringify({ id: 'ParentFlow', variables: [], nodes: [], routes: [] }),
    })

    renderEditor()

    expect(await screen.findByText('Function')).toBeTruthy()
    expect(screen.getByText('Manual')).toBeTruthy()
    expect(screen.getByText('Timer')).toBeTruthy()
    expect(screen.getByRole('button', { name: /manual confirm/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /wait until time/i })).toBeTruthy()
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

  it('edits a selected node condition route and saves branch metadata', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      subFlowTemplates: [],
      variableTypes: [],
      expressionOperators: [],
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'branch-flow',
      name: 'Branch Flow',
      revision: 3,
      updatedAt: '',
      draftDocumentJson: JSON.stringify({
        id: 'BranchFlow',
        variables: [
          { id: 'CanStore', type: 'bool', usage: 'inputOutput', initialValue: true },
          { id: 'BranchIndex', type: 'int', usage: 'inputOutput', initialValue: 0 },
        ],
        nodes: [
          baseDraftNode('CheckInventory'),
          baseDraftNode('StorePallet'),
          baseDraftNode('RejectPallet'),
        ],
        routes: [
          { type: 0, source: 'CheckInventory', targets: ['StorePallet'], kind: 0 },
        ],
      }),
    })
    vi.mocked(api.saveFlowDraft).mockResolvedValue({
      code: 'branch-flow',
      name: 'Branch Flow',
      revision: 4,
      updatedAt: '',
      draftDocumentJson: '{}',
    })

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/flows/branch-flow/editor']}>
          <Routes>
            <Route path="/flows/:code/editor" element={<FlowEditorPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(await screen.findByText('Outgoing routes')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Route mode'), { target: { value: 'condition' } })
    fireEvent.change(screen.getByLabelText('Condition variable'), { target: { value: 'CanStore' } })
    fireEvent.change(screen.getByLabelText('True target'), { target: { value: 'StorePallet' } })
    fireEvent.change(screen.getByLabelText('False target'), { target: { value: 'RejectPallet' } })
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => expect(api.saveFlowDraft).toHaveBeenCalled())
    const saveInput = vi.mocked(api.saveFlowDraft).mock.calls[0][1]
    const savedDocument = JSON.parse(saveInput.draftDocumentJson)
    expect(savedDocument.routes).toEqual(expect.arrayContaining([
      { type: 0, source: 'CheckInventory', targets: ['StorePallet', 'RejectPallet'], kind: 1, condition: 'CanStore' },
    ]))
  })

  it('edits switch routes and keeps ordered case targets', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      subFlowTemplates: [],
      variableTypes: [],
      expressionOperators: [],
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'switch-flow',
      name: 'Switch Flow',
      revision: 1,
      updatedAt: '',
      draftDocumentJson: JSON.stringify({
        id: 'SwitchFlow',
        variables: [
          { id: 'BranchIndex', type: 'int', usage: 'inputOutput', initialValue: 0 },
        ],
        nodes: [
          baseDraftNode('DecideRoute'),
          baseDraftNode('LaneA'),
          baseDraftNode('LaneB'),
        ],
        routes: [],
      }),
    })
    vi.mocked(api.saveFlowDraft).mockResolvedValue({
      code: 'switch-flow',
      name: 'Switch Flow',
      revision: 2,
      updatedAt: '',
      draftDocumentJson: '{}',
    })

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/flows/switch-flow/editor']}>
          <Routes>
            <Route path="/flows/:code/editor" element={<FlowEditorPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(await screen.findByText('Outgoing routes')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Route mode'), { target: { value: 'switch' } })
    fireEvent.change(screen.getByLabelText('Switch variable'), { target: { value: 'BranchIndex' } })
    fireEvent.change(screen.getByLabelText('Case 0 value'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Case 0 target'), { target: { value: 'LaneA' } })
    fireEvent.click(screen.getByRole('button', { name: /add case/i }))
    fireEvent.change(screen.getByLabelText('Case 1 value'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Case 1 target'), { target: { value: 'LaneB' } })
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => expect(api.saveFlowDraft).toHaveBeenCalled())
    const saveInput = vi.mocked(api.saveFlowDraft).mock.calls[0][1]
    const savedDocument = JSON.parse(saveInput.draftDocumentJson)
    expect(savedDocument.routes).toEqual(expect.arrayContaining([
      { type: 0, source: 'DecideRoute', targets: ['LaneA', 'LaneB'], caseValues: [2, 7], kind: 2, condition: 'BranchIndex' },
    ]))
  })

  it('renders translated route editor labels', async () => {
    localStorage.setItem('flowview.language', 'zh-Hans-CN')
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      variableTypes: [],
      expressionOperators: [],
      subFlowTemplates: [],
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'branch-flow',
      name: 'Branch Flow',
      revision: 1,
      updatedAt: '',
      draftDocumentJson: JSON.stringify({
        id: 'BranchFlow',
        variables: [{ id: 'CanStore', type: 'bool', usage: 'inputOutput', initialValue: true }],
        nodes: [baseDraftNode('CheckInventory'), baseDraftNode('StorePallet')],
        routes: [],
      }),
    })

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/flows/branch-flow/editor']}>
          <Routes>
            <Route path="/flows/:code/editor" element={<FlowEditorPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(await screen.findByText('出站路由')).toBeTruthy()
    expect(screen.getByLabelText('路由模式')).toBeTruthy()
  })
})

function renderEditor() {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/flows/parent-flow/editor']}>
        <Routes>
          <Route path="/flows/:code/editor" element={<FlowEditorPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

function baseDraftNode(id: string) {
  return {
    id,
    nodeType: 'Operation',
    description: '',
    shouldThrowOnFailed: true,
    shouldThrowOnCanceled: true,
    inputs: [],
    outputs: [],
    resourceOutputs: [],
    consoleId: 'FunctionConsole',
    operationTaskType: 'Backend.Demo.FunctionOperationTask',
  }
}
