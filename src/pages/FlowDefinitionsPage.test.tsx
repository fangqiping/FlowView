import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { api } from '../lib/api'
import { FlowDefinitionsPage } from './FlowDefinitionsPage'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    api: {
      getFlowDefinitions: vi.fn(),
      createFlowDefinition: vi.fn(),
      getFlowDraft: vi.fn(),
      getFlowVersions: vi.fn(),
      getFlowCatalog: vi.fn(),
      preflightFlow: vi.fn(),
      publishFlow: vi.fn(),
      activateFlowVersion: vi.fn(),
    },
  }
})

describe('FlowDefinitionsPage', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('loads definition list from the backend', async () => {
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([
      {
        code: 'child-flow',
        name: 'Child Flow',
        status: 'Draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'child-flow',
      name: 'Child Flow',
      revision: 1,
      draftDocumentJson: '{"nodes":[]}',
      updatedAt: new Date().toISOString(),
    })
    vi.mocked(api.getFlowVersions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      subFlowTemplates: [],
      variableTypes: [],
      expressionOperators: [],
    })

    render(
      <I18nProvider>
        <MemoryRouter>
          <FlowDefinitionsPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect((await screen.findAllByText('child-flow')).length).toBeGreaterThan(0)
    expect(screen.queryByText('inbound-basic')).toBeNull()
  })

  it('creates a new flow definition', async () => {
    vi.mocked(api.getFlowDefinitions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          code: 'child-flow',
          name: 'Child Flow',
          status: 'Draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      subFlowTemplates: [],
      variableTypes: [],
      expressionOperators: [],
    })
    vi.mocked(api.createFlowDefinition).mockResolvedValue({
      code: 'child-flow',
      name: 'Child Flow',
      revision: 1,
      draftDocumentJson: '{"nodes":[]}',
      updatedAt: new Date().toISOString(),
    })
    vi.mocked(api.getFlowDraft).mockResolvedValue({
      code: 'child-flow',
      name: 'Child Flow',
      revision: 1,
      draftDocumentJson: '{"nodes":[]}',
      updatedAt: new Date().toISOString(),
    })
    vi.mocked(api.getFlowVersions).mockResolvedValue([])

    render(
      <I18nProvider>
        <MemoryRouter>
          <FlowDefinitionsPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /new flow/i }))
    fireEvent.change(screen.getByLabelText(/code/i), { target: { value: 'child-flow' } })
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Child Flow' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(api.createFlowDefinition).toHaveBeenCalledWith({
        code: 'child-flow',
        name: 'Child Flow',
        description: '',
      })
    })
  })

  it('renders translated flow definition actions', async () => {
    localStorage.setItem('flowview.language', 'zh-Hans-CN')
    vi.mocked(api.getFlowDefinitions).mockResolvedValue([])
    vi.mocked(api.getFlowCatalog).mockResolvedValue({
      operations: [],
      subFlowTemplates: [],
      variableTypes: [],
      expressionOperators: [],
    })

    render(
      <I18nProvider>
        <MemoryRouter>
          <FlowDefinitionsPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(await screen.findByRole('button', { name: /新建流程/ })).toBeTruthy()
    expect(screen.getByText('流程定义')).toBeTruthy()
    expect(screen.getByText('暂无流程定义。')).toBeTruthy()
  })
})
