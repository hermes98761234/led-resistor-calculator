import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { UK, tr } from './i18n'

const ph = (s: string) => [...s.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort().join()

describe('i18n', () => {
  it('keeps placeholders in every translation', () => {
    for (const [k, v] of Object.entries(UK)) {
      expect(v.length, k).toBeGreaterThan(0)
      expect(ph(v), k).toBe(ph(k))
    }
  })
  it('translates every string used in the source', () => {
    const files = ['App.tsx', 'components/Diagram.tsx', 'lib/led.ts', 'lib/state.ts'].map((f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'))
    const re = /(?:\bt\(\s*|\b(?:key|name): )(['"])(.*?)\1/g
    const missing: string[] = []
    for (const src of files) for (const m of src.matchAll(re)) if (!(m[2] in UK) && m[2] !== 'LED') missing.push(m[2])
    expect(missing).toEqual([])
  })
  it('interpolates', () => {
    expect(tr('uk', 'Use {0}', '150 Ω')).toBe('Візьміть 150 Ω')
    expect(tr('en', 'Use {0}', '150 Ω')).toBe('Use 150 Ω')
  })
})
