import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, setApiLanguage } from './api'

describe('api localization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setApiLanguage('en-US')
  })

  it('attaches Accept-Language to requests', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))
    setApiLanguage('zh-Hans-CN')

    await api.getSkus()

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(new Headers(init?.headers).get('Accept-Language')).toBe('zh-Hans-CN')
  })
})
