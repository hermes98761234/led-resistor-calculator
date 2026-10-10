import { describe, expect, it } from 'vitest'
import { design, fmtOhm, fmtPower, mantissas, neighbours, optimizeArray, pickResistor, recommendRating, resistorValues, type DesignParams } from './led'

const base: DesignParams = {
  vs: 5, vf: 2, current: 20, maxCurrent: 30, series: 1, strings: 1, shared: false, eseries: 'E24', rounding: 'nearest',
  resTol: 5, supplyTol: 5, vfSpread: 0.2,
}

describe('E series', () => {
  it('has the right number of values and the textbook E12/E6/E24 sets', () => {
    expect(mantissas('E6')).toEqual([1.0, 1.5, 2.2, 3.3, 4.7, 6.8])
    expect(mantissas('E12')).toEqual([1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2])
    expect(mantissas('E24')).toHaveLength(24)
    expect(mantissas('E48')).toHaveLength(48)
    expect(mantissas('E96')).toHaveLength(96)
  })
  it('E48 and E96 match the IEC 60063 tables', () => {
    const e96 = mantissas('E96')
    expect(e96.slice(0, 12)).toEqual([1.0, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3])
    expect(e96.slice(-4)).toEqual([9.09, 9.31, 9.53, 9.76])
    const e48 = mantissas('E48')
    expect(e48.slice(0, 6)).toEqual([1.0, 1.05, 1.1, 1.15, 1.21, 1.27])
    expect(e48.slice(-3)).toEqual([8.66, 9.09, 9.53])
  })
  it('picks nearest, up and down', () => {
    expect(pickResistor(150, 'E12', 'nearest')).toBe(150)
    expect(pickResistor(160, 'E12', 'nearest')).toBe(150)
    expect(pickResistor(168, 'E12', 'nearest')).toBe(180)
    expect(pickResistor(151, 'E12', 'up')).toBe(180)
    expect(pickResistor(179, 'E12', 'down')).toBe(150)
    expect(pickResistor(150, 'E12', 'up')).toBe(150)
    expect(pickResistor(150, 'E12', 'down')).toBe(150)
    expect(pickResistor(0, 'E12', 'up')).toBeNull()
    expect(neighbours(160, 'E12')).toEqual([150, 180])
  })
  it('spans decades cleanly', () => {
    const v = resistorValues('E12')
    expect(v[0]).toBe(1)
    expect(v).toContain(4700)
    expect(v).toContain(2200000)
    expect(v.every((x) => Number.isFinite(x))).toBe(true)
  })
})

describe('design', () => {
  it('5 V, red LED 2 V, 20 mA needs exactly 150 ohm', () => {
    const d = design(base)
    expect(d.exactR).toBeCloseTo(150, 9)
    expect(d.r).toBe(150)
    expect(d.stringCurrent).toBeCloseTo(20, 9)
    expect(d.resistorPower).toBeCloseTo(0.06, 9)
    expect(d.rating).toBe(0.125)
    expect(d.efficiency).toBeCloseTo(0.4, 9)
    expect(d.totalCurrent).toBeCloseTo(20, 9)
  })
  it('12 V with three white LEDs in series is 120 ohm', () => {
    const d = design({ ...base, vs: 12, vf: 3.2, series: 3 })
    expect(d.exactR).toBeCloseTo(120, 9)
    expect(d.efficiency).toBeCloseTo(9.6 / 12, 9)
  })
  it('real current with a rounded-up E12 resistor is lower', () => {
    const d = design({ ...base, vs: 9, vf: 2.1, eseries: 'E12', rounding: 'up' }) // exact 345 -> 390
    expect(d.exactR).toBeCloseTo(345, 9)
    expect(d.r).toBe(390)
    expect(d.stringCurrent).toBeCloseTo((6.9 / 390) * 1000, 9)
    expect(d.ratio).toBeLessThan(1)
  })
  it('parallel strings with own resistors multiply the supply current', () => {
    const d = design({ ...base, strings: 4 })
    expect(d.resistors).toBe(4)
    expect(d.totalCurrent).toBeCloseTo(80, 9)
    expect(d.leds).toBe(4)
    expect(d.efficiency).toBeCloseTo(0.4, 9)
  })
  it('a shared resistor carries every string current', () => {
    const d = design({ ...base, strings: 2, shared: true })
    expect(d.exactR).toBeCloseTo(75, 9)
    expect(d.resistors).toBe(1)
    expect(d.stringCurrent).toBeCloseTo(20, 9)
    expect(d.resistorPower).toBeCloseTo(0.04 * 0.04 * 75, 9)
    expect(d.warnings.some((w) => w.key.startsWith('One shared'))).toBe(true)
  })
  it('reports invalid designs when the supply is too low', () => {
    const d = design({ ...base, vs: 3.3, vf: 3.2, series: 2 })
    expect(d.valid).toBe(false)
    expect(d.warnings).toHaveLength(1)
  })
  it('warns when the chosen resistor overdrives the LED', () => {
    const d = design({ ...base, vs: 5, vf: 2, current: 30, maxCurrent: 20 })
    expect(d.warnings.some((w) => w.key.startsWith('LED current'))).toBe(true)
  })
  it('worst case brackets nominal and warns on low headroom', () => {
    const d = design({ ...base, vs: 3.3, vf: 2.8, current: 10, eseries: 'E96' })
    expect(d.worstMin).toBeLessThan(d.stringCurrent)
    expect(d.worstMax).toBeGreaterThan(d.stringCurrent)
    expect(d.warnings.some((w) => w.key.startsWith('Only'))).toBe(true)
  })
  it('evaluates a forced resistor', () => {
    const d = design(base, 100)
    expect(d.stringCurrent).toBeCloseTo(30, 9)
    expect(d.warnings.some((w) => w.key.startsWith('LED current'))).toBe(false)
    expect(design({ ...base, maxCurrent: 25 }, 100).warnings.some((w) => w.key.startsWith('LED current'))).toBe(true)
  })
  it('zero tolerance gives the nominal current', () => {
    const d = design({ ...base, resTol: 0, supplyTol: 0, vfSpread: 0 })
    expect(d.worstMin).toBeCloseTo(d.stringCurrent, 9)
    expect(d.worstMax).toBeCloseTo(d.stringCurrent, 9)
  })
})

describe('ratings and formats', () => {
  it('recommends 2x derated standard wattage', () => {
    expect(recommendRating(0.06)).toBe(0.125)
    expect(recommendRating(0.13)).toBe(0.5)
    expect(recommendRating(0.3)).toBe(1)
    expect(recommendRating(50)).toBeNull()
  })
  it('formats', () => {
    expect(fmtOhm(150)).toBe('150 Ω')
    expect(fmtOhm(1500)).toBe('1.5 kΩ')
    expect(fmtOhm(2.2e6)).toBe('2.2 MΩ')
    expect(fmtPower(0.06)).toBe('60 mW')
    expect(fmtPower(1.5)).toBe('1.5 W')
  })
})

describe('array optimizer', () => {
  it('prefers using every LED and then efficiency', () => {
    // 12 V, 3.2 V white LEDs, 12 LEDs: 3 in series is the best (9.6/12 = 80 %), 4 strings of 3
    const opts = optimizeArray({ ...base, vs: 12, vf: 3.2 }, 12)
    expect(opts[0].series).toBe(3)
    expect(opts[0].strings).toBe(4)
    expect(opts[0].unused).toBe(0)
    expect(opts[0].design.efficiency).toBeCloseTo(0.8, 9)
    expect(opts.every((o) => o.series * 3.2 < 12)).toBe(true)
    expect(opts.map((o) => o.series)).toEqual(expect.arrayContaining([1, 2, 3]))
  })
  it('puts layouts that waste LEDs after those that use all', () => {
    // 5 V, 2 V LEDs, 7 LEDs: only 1 or 2 in series; 2x3 leaves one unused, 1x7 uses all
    const opts = optimizeArray(base, 7)
    expect(opts[0]).toMatchObject({ series: 1, strings: 7, unused: 0 })
    expect(opts[1]).toMatchObject({ series: 2, strings: 3, unused: 1 })
  })
})
