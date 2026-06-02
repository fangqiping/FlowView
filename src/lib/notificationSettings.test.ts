import { describe, expect, it } from 'vitest'
import { notificationLevelMeetsThreshold } from './notificationSettings'

describe('notificationLevelMeetsThreshold', () => {
  it('allows every level when receive threshold is all', () => {
    expect(notificationLevelMeetsThreshold(0, 'all')).toBe(true)
    expect(notificationLevelMeetsThreshold(1, 'all')).toBe(true)
  })

  it('suppresses information when threshold is warning-plus', () => {
    expect(notificationLevelMeetsThreshold(0, 'warning-plus')).toBe(false)
    expect(notificationLevelMeetsThreshold(1, 'warning-plus')).toBe(true)
    expect(notificationLevelMeetsThreshold(2, 'warning-plus')).toBe(true)
  })

  it('suppresses all popups when threshold is off', () => {
    expect(notificationLevelMeetsThreshold(3, 'off')).toBe(false)
  })
})
