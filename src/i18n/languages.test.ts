import { describe, expect, it } from 'vitest'
import { canonicalizeLanguage, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './languages'

describe('languages', () => {
  it('supports en-US and zh-Hans-CN', () => {
    expect(SUPPORTED_LANGUAGES.map((language) => language.code)).toEqual(['en-US', 'zh-Hans-CN'])
  })

  it('canonicalizes browser and API language aliases', () => {
    expect(canonicalizeLanguage('en')).toBe('en-US')
    expect(canonicalizeLanguage('en-US')).toBe('en-US')
    expect(canonicalizeLanguage('zh-CN')).toBe('zh-Hans-CN')
    expect(canonicalizeLanguage('zh-Hans')).toBe('zh-Hans-CN')
    expect(canonicalizeLanguage('zh-Hans-CN')).toBe('zh-Hans-CN')
  })

  it('falls back to en-US for unsupported or missing languages', () => {
    expect(DEFAULT_LANGUAGE).toBe('en-US')
    expect(canonicalizeLanguage(undefined)).toBe('en-US')
    expect(canonicalizeLanguage('fr-FR')).toBe('en-US')
  })
})
