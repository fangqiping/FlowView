import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { ResourceSummaryPanel } from './ResourceSummaryPanel'

describe('ResourceSummaryPanel', () => {
  it('renders rule match, transitions, and summary fields', () => {
    render(
      <I18nProvider>
        <ResourceSummaryPanel
          summary={{
            title: 'Warehouse Resources',
            ruleMatch: 'occupied-rack-location',
            transition: {
              before: 'Requested RACK-A1 for SKU-001',
              after: 'Locked RACK-A2 with pallet PLT-SEED-RACK-A2',
            },
            fields: [
              { label: 'Resolved Location', value: 'RACK-A2' },
              { label: 'Lock State', value: 'Locked' },
            ],
          }}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Warehouse Resources')).toBeTruthy()
    expect(screen.getByText('occupied-rack-location')).toBeTruthy()
    expect(screen.getByText('Requested RACK-A1 for SKU-001')).toBeTruthy()
    expect(screen.getByText('Locked RACK-A2 with pallet PLT-SEED-RACK-A2')).toBeTruthy()
    expect(screen.getByText('Resolved Location')).toBeTruthy()
    expect(screen.getByText('RACK-A2')).toBeTruthy()
  })
})
