export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type ESeries = 'E6' | 'E12' | 'E24' | 'E48' | 'E96'
export type Rounding = 'nearest' | 'up' | 'down'

export interface LedColor {
  id: string
  name: string
  /** Typical forward voltage at 20 mA, volts. */
  vf: number
  /** Typical test current, mA. */
  current: number
}

/** Typical forward voltages at 20 mA (datasheet ranges vary by maker, so always check yours). */
export const LED_COLORS: LedColor[] = [
  { id: 'ir', name: 'Infrared (940 nm)', vf: 1.3, current: 20 },
  { id: 'red', name: 'Red', vf: 2.0, current: 20 },
  { id: 'orange', name: 'Orange', vf: 2.0, current: 20 },
  { id: 'yellow', name: 'Yellow', vf: 2.1, current: 20 },
  { id: 'green', name: 'Green (classic)', vf: 2.2, current: 20 },
  { id: 'green-ingan', name: 'Green (InGaN, bright)', vf: 3.0, current: 20 },
  { id: 'blue', name: 'Blue', vf: 3.1, current: 20 },
  { id: 'white', name: 'White', vf: 3.2, current: 20 },
  { id: 'warm-white', name: 'Warm white', vf: 3.0, current: 20 },
  { id: 'uv', name: 'UV (395 nm)', vf: 3.4, current: 20 },
]

const E24 = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
]
const STEPS: Record<ESeries, number> = { E6: 6, E12: 12, E24: 24, E48: 48, E96: 96 }
export const E_SERIES: ESeries[] = ['E6', 'E12', 'E24', 'E48', 'E96']

/** Mantissas (1.00 ≤ m < 10) of one decade. E6 to E24 are the tabulated values, E48 and E96 follow the rounded formula. */
export function mantissas(series: ESeries): number[] {
  switch (series) {
    case 'E6':
      return E24.filter((_, i) => i % 4 === 0)
    case 'E12':
      return E24.filter((_, i) => i % 2 === 0)
    case 'E24':
      return E24
    default: {
      const n = STEPS[series]
      return Array.from({ length: n }, (_, i) => Math.round(10 ** (i / n) * 100) / 100)
    }
  }
}

const clean = (x: number) => Number(x.toPrecision(6))

/** All standard resistor values in [min, max] ohms. */
export function resistorValues(series: ESeries, min = 1, max = 10e6): number[] {
  const out: number[] = []
  const m = mantissas(series)
  for (let d = 0; d <= 7; d++) for (const x of m) out.push(clean(x * 10 ** d))
  return out.filter((v) => v >= min && v <= max)
}

/** The standard value nearest to r (by ratio), the next one up, or the next one down. */
export function pickResistor(r: number, series: ESeries, mode: Rounding): number | null {
  if (!(r > 0) || !Number.isFinite(r)) return null
  const vals = resistorValues(series)
  const eps = 1 + 1e-9
  if (mode === 'up') return vals.find((v) => v * eps >= r) ?? null
  if (mode === 'down') return [...vals].reverse().find((v) => v <= r * eps) ?? null
  let best = vals[0]
  for (const v of vals) if (Math.abs(Math.log(v / r)) < Math.abs(Math.log(best / r))) best = v
  return best
}

/** Neighbouring standard values: [below-or-equal, above-or-equal] (equal when r is itself standard). */
export function neighbours(r: number, series: ESeries): [number | null, number | null] {
  return [pickResistor(r, series, 'down'), pickResistor(r, series, 'up')]
}

export const POWER_RATINGS = [0.0625, 0.125, 0.25, 0.5, 1, 2, 3, 5, 10]

/** Smallest standard rating that is at least `factor` times the dissipation. */
export function recommendRating(power: number, factor = 2): number | null {
  return POWER_RATINGS.find((w) => w >= power * factor - 1e-12) ?? null
}

export interface Warning {
  /** English source string with {0}… placeholders. */
  key: string
  args: (string | number)[]
}

export interface DesignParams {
  /** Supply voltage, V. */
  vs: number
  /** LED forward voltage, V. */
  vf: number
  /** Target current per LED string, mA. */
  current: number
  /** Absolute maximum LED current, mA. */
  maxCurrent: number
  /** LEDs in series per string. */
  series: number
  /** Parallel strings. */
  strings: number
  /** One resistor shared by all strings (not recommended). */
  shared: boolean
  eseries: ESeries
  rounding: Rounding
  /** Resistor tolerance, %. */
  resTol: number
  /** Supply tolerance, %. */
  supplyTol: number
  /** Forward voltage spread, ± V per LED. */
  vfSpread: number
}

export interface Design {
  valid: boolean
  /** Voltage left for the resistor, V. */
  headroom: number
  exactR: number
  /** Chosen standard value, ohms. */
  r: number
  resistors: number
  /** Real current per string, mA. */
  stringCurrent: number
  /** Real current through each LED relative to the target. */
  ratio: number
  /** Total supply current, mA. */
  totalCurrent: number
  /** Dissipation in each resistor, W. */
  resistorPower: number
  /** Recommended resistor rating, W (null when above the table). */
  rating: number | null
  /** Power in one LED, W. */
  ledPower: number
  /** Total input power, W. */
  inputPower: number
  /** LED power / input power. */
  efficiency: number
  leds: number
  /** Worst-case per-string current range over all tolerances, mA. */
  worstMin: number
  worstMax: number
  warnings: Warning[]
}

const fin = (x: number) => (Number.isFinite(x) ? x : 0)

/** `forceR` evaluates a specific resistor value instead of picking one from the series. */
export function design(p: DesignParams, forceR?: number): Design {
  const n = Math.max(1, Math.round(p.series))
  const m = Math.max(1, Math.round(p.strings))
  const shared = p.shared && m > 1
  const headroom = p.vs - n * p.vf
  const iTarget = p.current / 1000
  const iRes = shared ? iTarget * m : iTarget
  const warnings: Warning[] = []
  const bad = !(p.vs > 0 && p.vf > 0 && p.current > 0) || headroom <= 0
  const exactR = bad ? 0 : headroom / iRes
  const r = bad ? 0 : (forceR ?? pickResistor(exactR, p.eseries, p.rounding) ?? exactR)
  const resistors = shared ? 1 : m
  const empty: Design = {
    valid: false, headroom, exactR: 0, r: 0, resistors, stringCurrent: 0, ratio: 0, totalCurrent: 0, resistorPower: 0, rating: null,
    ledPower: 0, inputPower: 0, efficiency: 0, leds: n * m, worstMin: 0, worstMax: 0, warnings,
  }
  if (bad) {
    if (p.vs > 0 && p.vf > 0 && headroom <= 0)
      warnings.push({ key: 'The supply ({0} V) must be higher than the LEDs in series ({1} V). Use fewer LEDs per string or a higher supply.', args: [round(p.vs, 2), round(n * p.vf, 2)] })
    return empty
  }
  const resCurrent = headroom / r // A, through each resistor
  const stringCurrent = (shared ? resCurrent / m : resCurrent) * 1000
  const resistorPower = resCurrent * resCurrent * r
  const totalA = resCurrent * resistors
  const ledPower = p.vf * (stringCurrent / 1000)
  const inputPower = p.vs * totalA
  const efficiency = inputPower > 0 ? (ledPower * n * m) / inputPower : 0
  const lo = (p.vs * (1 - p.supplyTol / 100) - n * (p.vf + p.vfSpread)) / (r * (1 + p.resTol / 100))
  const hi = (p.vs * (1 + p.supplyTol / 100) - n * (p.vf - p.vfSpread)) / (r * (1 - p.resTol / 100))
  const div = shared ? m : 1
  const worstMin = Math.max(0, (lo * 1000) / div)
  const worstMax = (hi * 1000) / div
  if (stringCurrent > p.maxCurrent + 1e-9)
    warnings.push({ key: 'LED current {0} mA is above the {1} mA maximum. Choose a larger resistor.', args: [round(stringCurrent, 1), round(p.maxCurrent, 1)] })
  else if (worstMax > p.maxCurrent + 1e-9)
    warnings.push({ key: 'With tolerances the current can reach {0} mA, above the {1} mA maximum.', args: [round(worstMax, 1), round(p.maxCurrent, 1)] })
  if (headroom < 1)
    warnings.push({ key: 'Only {0} V is left for the resistor, so the current is very sensitive to supply and Vf variation. Consider a constant-current driver.', args: [round(headroom, 2)] })
  if (shared)
    warnings.push({ key: 'One shared resistor does not balance the strings: LEDs with a lower Vf take more current. Use one resistor per string.', args: [] })
  if (r < 1) warnings.push({ key: 'The resistor is below 1 Ω: use a constant-current source instead.', args: [] })
  return {
    valid: true, headroom, exactR, r, resistors, stringCurrent, ratio: stringCurrent / p.current, totalCurrent: totalA * 1000, resistorPower,
    rating: recommendRating(resistorPower), ledPower, inputPower, efficiency: fin(efficiency), leds: n * m, worstMin, worstMax, warnings,
  }
}

export function round(x: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(x * f) / f
}

export interface ArrayOption {
  series: number
  strings: number
  used: number
  unused: number
  design: Design
}

/**
 * Every way to wire up to `total` LEDs as `strings` parallel strings of `series` LEDs that the supply can drive,
 * best first: most LEDs used, then highest efficiency, then fewest resistors.
 */
export function optimizeArray(base: DesignParams, total: number): ArrayOption[] {
  const out: ArrayOption[] = []
  const t = Math.max(1, Math.round(total))
  for (let s = 1; s <= t; s++) {
    if (base.vs - s * base.vf <= 0) break
    const m = Math.floor(t / s)
    const d = design({ ...base, series: s, strings: m, shared: false })
    if (d.valid) out.push({ series: s, strings: m, used: s * m, unused: t - s * m, design: d })
  }
  return out.sort(
    (a, b) =>
      a.unused - b.unused || b.design.efficiency - a.design.efficiency || a.design.resistors - b.design.resistors || a.series - b.series,
  )
}

/** 1500 → "1.5 kΩ", 220 → "220 Ω". */
export function fmtOhm(r: number): string {
  if (r >= 1e6) return `${trim(r / 1e6)} MΩ`
  if (r >= 1e3) return `${trim(r / 1e3)} kΩ`
  return `${trim(r)} Ω`
}

function trim(x: number): string {
  return String(Number(x.toPrecision(4)))
}

export function fmtPower(w: number): string {
  if (w >= 1) return `${trim(w)} W`
  if (w >= 0.001) return `${trim(w * 1000)} mW`
  return `${trim(w * 1e6)} µW`
}

export function fmtFraction(w: number): string {
  if (w === 0.0625) return '1/16 W'
  if (w === 0.125) return '1/8 W'
  if (w === 0.25) return '1/4 W'
  if (w === 0.5) return '1/2 W'
  return `${w} W`
}
