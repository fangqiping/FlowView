import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, api, setApiLanguage } from './api'

describe('api localization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

describe('scheduling api', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function stubFetch() {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  }

  function expectRequest(path: string, method: string) {
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`${API_BASE_URL}${path}`)
    expect(init?.method ?? 'GET').toBe(method)
    return init
  }

  it('gets the current schedule plan', async () => {
    stubFetch()

    await api.getCurrentSchedulePlan()

    expectRequest('/api/SchedulePlans/current', 'GET')
  })

  it('gets a schedule plan by id', async () => {
    stubFetch()

    await api.getSchedulePlan(18)

    expectRequest('/api/SchedulePlans/18', 'GET')
  })

  it('gets schedule plan history', async () => {
    stubFetch()

    await api.getSchedulePlanHistory()

    expectRequest('/api/SchedulePlans/history', 'GET')
  })

  it('compares two schedule plans', async () => {
    stubFetch()

    await api.compareSchedulePlans(18, 17)

    expectRequest('/api/SchedulePlans/18/comparison?previousPlanId=17', 'GET')
  })

  it('requests a schedule replan without a body', async () => {
    stubFetch()

    await api.requestScheduleReplan()

    const init = expectRequest('/api/SchedulePlans/replan', 'POST')
    expect(init).not.toHaveProperty('body')
  })
})
