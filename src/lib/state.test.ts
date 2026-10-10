import { describe, expect, it } from 'vitest'
import { DEFAULT_STATE, SCENARIOS, sanitize, toParams } from './state'
import { design } from './led'

describe('state', () => {
  it('falls back to defaults on garbage', () => {
    const s = sanitize({ vs: -4, series: 'x', eseries: 'E999', color: 'pink', lang: 'uk', theme: 'dark' })
    expect(s.vs).toBe(DEFAULT_STATE.vs)
    expect(s.series).toBe(DEFAULT_STATE.series)
    expect(s.eseries).toBe('E24')
    expect(s.color).toBe('white')
    expect(s.lang).toBe('uk')
    expect(s.theme).toBe('dark')
  })
  it('keeps valid values', () => {
    expect(sanitize({ vs: 5, strings: 3.4, rounding: 'down' })).toMatchObject({ vs: 5, strings: 3, rounding: 'down' })
  })
  it('every scenario and the default produce valid designs', () => {
    for (const sc of [{ patch: {} }, ...SCENARIOS]) {
      expect(design(toParams({ ...DEFAULT_STATE, ...sc.patch })).valid).toBe(true)
    }
  })
})
