import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from './I18nProvider'
import { useI18n } from './useI18n'

function Probe() {
  const { language, setLanguage, t } = useI18n()
  return (
    <div>
      <span>{language}</span>
      <strong>{t('nav.inboundOrders')}</strong>
      <button onClick={() => setLanguage('zh-Hans-CN')}>switch</button>
    </div>
  )
}

describe('I18nProvider', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('uses en-US by default and switches to zh-Hans-CN', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText('en-US')).toBeTruthy()
    expect(screen.getByText('Inbound Orders')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    expect(screen.getByText('zh-Hans-CN')).toBeTruthy()
    expect(screen.getByText('入库订单')).toBeTruthy()
    expect(localStorage.getItem('flowview.language')).toBe('zh-Hans-CN')
  })
})
