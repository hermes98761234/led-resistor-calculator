import { E_SERIES, LED_COLORS, type DesignParams, type ESeries, type Lang, type Rounding, type Theme } from './led'

export interface AppState {
  vs: number
  color: string // LED_COLORS id or 'custom'
  vf: number
  current: number
  maxCurrent: number
  series: number
  strings: number
  shared: boolean
  eseries: ESeries
  rounding: Rounding
  resTol: number
  supplyTol: number
  vfSpread: number
  total: number
  lang: Lang
  theme: Theme
}

export const DEFAULT_STATE: AppState = {
  vs: 12, color: 'white', vf: 3.2, current: 15, maxCurrent: 30, series: 3, strings: 2, shared: false, eseries: 'E24', rounding: 'up',
  resTol: 5, supplyTol: 5, vfSpread: 0.2, total: 12, lang: 'en', theme: 'auto',
}

export interface Scenario {
  name: string
  patch: Partial<AppState>
}

export const SCENARIOS: Scenario[] = [
  { name: 'Red LED on 5 V', patch: { vs: 5, color: 'red', vf: 2.0, current: 20, series: 1, strings: 1, shared: false, total: 8 } },
  { name: 'Blue LED on 3.3 V', patch: { vs: 3.3, color: 'blue', vf: 3.1, current: 10, series: 1, strings: 1, shared: false, total: 4 } },
  { name: '3 white LEDs on 12 V', patch: { vs: 12, color: 'white', vf: 3.2, current: 20, series: 3, strings: 1, shared: false, total: 12 } },
  { name: '12 green LEDs on 24 V', patch: { vs: 24, color: 'green', vf: 2.2, current: 20, series: 10, strings: 1, shared: false, total: 12 } },
  { name: 'Red LED strip on a 9 V battery', patch: { vs: 9, color: 'red', vf: 2.0, current: 15, series: 3, strings: 2, shared: false, total: 6 } },
]

const KEY = 'led-resistor-calculator:v1'

const num = (x: unknown, min: number, max: number, d: number) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : d)

/** Validates untrusted stored data field by field, falling back to defaults. */
export function sanitize(raw: unknown): AppState {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_STATE
  const color = typeof o.color === 'string' && (o.color === 'custom' || LED_COLORS.some((c) => c.id === o.color)) ? o.color : d.color
  return {
    vs: num(o.vs, 0.1, 1000, d.vs),
    color,
    vf: num(o.vf, 0.1, 50, d.vf),
    current: num(o.current, 0.01, 5000, d.current),
    maxCurrent: num(o.maxCurrent, 0.01, 5000, d.maxCurrent),
    series: Math.round(num(o.series, 1, 100, d.series)),
    strings: Math.round(num(o.strings, 1, 1000, d.strings)),
    shared: o.shared === true,
    eseries: E_SERIES.includes(o.eseries as ESeries) ? (o.eseries as ESeries) : d.eseries,
    rounding: o.rounding === 'nearest' || o.rounding === 'up' || o.rounding === 'down' ? o.rounding : d.rounding,
    resTol: num(o.resTol, 0, 50, d.resTol),
    supplyTol: num(o.supplyTol, 0, 50, d.supplyTol),
    vfSpread: num(o.vfSpread, 0, 5, d.vfSpread),
    total: Math.round(num(o.total, 1, 500, d.total)),
    lang: o.lang === 'uk' ? 'uk' : o.lang === 'en' ? 'en' : navigator.language?.startsWith('uk') ? 'uk' : 'en',
    theme: o.theme === 'light' || o.theme === 'dark' || o.theme === 'auto' ? o.theme : d.theme,
  }
}

export function loadState(): AppState {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return sanitize(null)
  }
}

export function saveState(s: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

export function toParams(s: AppState): DesignParams {
  return {
    vs: s.vs, vf: s.vf, current: s.current, maxCurrent: s.maxCurrent, series: s.series, strings: s.strings, shared: s.shared,
    eseries: s.eseries, rounding: s.rounding, resTol: s.resTol, supplyTol: s.supplyTol, vfSpread: s.vfSpread,
  }
}
