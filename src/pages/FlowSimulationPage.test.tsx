import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { api } from '../lib/api'
import { FlowSimulationPage } from './FlowSimulationPage'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    api: {
      getFlowVersions: vi.fn(),
    },
  }
})

describe('FlowSimulationPage', () => {
  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('renders the last preflight simulation from session storage', async () => {
    sessionStorage.setItem('flowview.simulation.parent-flow', JSON.stringify({
      code: 'parent-flow',
      totalDurationMilliseconds: 3000,
      nodes: [
        {
          nodeId: 'Pick',
          nodeType: 'Operation',
          estimatedDurationMilliseconds: 3000,
          earliestStartMilliseconds: 0,
          earliestEndMilliseconds: 3000,
          dependencyNodeIds: [],
          isCriticalPath: true,
        },
      ],
    }))

    renderPage('/flows/parent-flow/simulation')

    const gantt = await screen.findByLabelText('Simulation Gantt')
    expect(within(gantt).getByText('Simulation Gantt')).toBeTruthy()
    expect(screen.getByText('Total 3.0s')).toBeTruthy()
    expect(screen.getByText('Pick')).toBeTruthy()
  })

  it('renders a published version simulation from the backend', async () => {
    vi.mocked(api.getFlowVersions).mockResolvedValue([
      {
        id: 7,
        code: 'parent-flow',
        versionNumber: 7,
        runtimeFlowId: 'db:parent-flow:v7',
        sourceDraftRevision: 9,
        sourceGraphJson: '{}',
        compiledGraphJson: '{}',
        publishedAt: new Date().toISOString(),
        status: 1,
        isActive: true,
        simulation: {
          code: 'parent-flow',
          totalDurationMilliseconds: 4000,
          nodes: [
            {
              nodeId: 'Pack',
              nodeType: 'Operation',
              estimatedDurationMilliseconds: 4000,
              earliestStartMilliseconds: 0,
              earliestEndMilliseconds: 4000,
              dependencyNodeIds: [],
              isCriticalPath: true,
            },
          ],
        },
      },
    ])

    renderPage('/flows/parent-flow/simulation?version=7')

    expect(await screen.findByText('Flow Simulation · parent-flow')).toBeTruthy()
    expect(screen.getByText('Total 4.0s')).toBeTruthy()
    expect(screen.getByText('Pack')).toBeTruthy()
  })
})

function renderPage(initialEntry: string) {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/flows/:code/simulation" element={<FlowSimulationPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}
