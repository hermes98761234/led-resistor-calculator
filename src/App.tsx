import { useEffect, useMemo, useState } from 'react'
import { E_SERIES, LED_COLORS, design, fmtFraction, fmtOhm, fmtPower, neighbours, optimizeArray, round, type ESeries, type Rounding, type Theme } from './lib/led'
import { DEFAULT_STATE, SCENARIOS, loadState, saveState, toParams, type AppState } from './lib/state'
import { tr, type T } from './i18n'
import NumberField from './components/NumberField'
import Diagram from './components/Diagram'

const pct = (x: number) => `${round(x * 100, 1)} %`
const mA = (x: number) => `${round(x, x < 10 ? 2 : 1)} mA`

export default function App() {
  const [s, setS] = useState<AppState>(loadState)
  const t: T = (a, ...b) => tr(s.lang, a, ...b)
  const set = (patch: Partial<AppState>) => setS((o) => ({ ...o, ...patch }))
  useEffect(() => saveState(s), [s])
  useEffect(() => {
    const root = document.documentElement
    if (s.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = s.theme
    root.lang = s.lang
  }, [s.theme, s.lang])

  const params = useMemo(() => toParams(s), [s])
  const d = useMemo(() => design(params), [params])
  const options = useMemo(() => optimizeArray(params, s.total), [params, s.total])
  const [lo, hi] = d.valid ? neighbours(d.exactR, s.eseries) : [null, null]
  const series = s.series
  const candidates = useMemo(() => {
    if (!d.valid) return []
    const vals = new Set<number>()
    for (const v of [lo, hi, d.r]) if (v) vals.add(v)
    return [...vals].sort((a, b) => a - b)
  }, [d, lo, hi])

  const pickColor = (id: string) => {
    const c = LED_COLORS.find((x) => x.id === id)
    set(c ? { color: id, vf: c.vf, current: c.current } : { color: 'custom' })
  }

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('LED resistor calculator')}</span>
        <span className="hint">{t('Resistor, power and wiring for single LEDs and series/parallel arrays.')}</span>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <div className="section">
              <h3>{t('Examples')}</h3>
              <div className="row">
                {SCENARIOS.map((sc) => (
                  <button key={sc.name} className="small" onClick={() => set(sc.patch)}>
                    {t(sc.name)}
                  </button>
                ))}
              </div>
            </div>
            <div className="section">
              <h3>{t('Supply')}</h3>
              <NumberField label={t('Supply voltage')} unit="V" value={s.vs} min={0.1} max={1000} onChange={(v) => set({ vs: v })} />
            </div>
            <div className="section">
              <h3>LED</h3>
              <div className="field">
                <label htmlFor="color">{t('Colour')}</label>
                <select id="color" value={s.color} onChange={(e) => pickColor(e.target.value)}>
                  {LED_COLORS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {t(c.name)} · {c.vf} V
                    </option>
                  ))}
                  <option value="custom">{t('Custom')}</option>
                </select>
              </div>
              <div className="grid2">
                <NumberField label={t('Forward voltage Vf')} unit="V" value={s.vf} min={0.1} max={50} onChange={(v) => set({ vf: v, color: LED_COLORS.find((c) => c.id === s.color)?.vf === v ? s.color : 'custom' })} />
                <NumberField label={t('Current per LED')} unit="mA" value={s.current} min={0.01} max={5000} onChange={(v) => set({ current: v })} />
              </div>
              <NumberField label={t('Absolute maximum current')} unit="mA" value={s.maxCurrent} min={0.01} max={5000} onChange={(v) => set({ maxCurrent: v })} hint={t('From the datasheet. Typical 5 mm LEDs: 20–30 mA.')} />
            </div>
            <div className="section">
              <h3>{t('Array')}</h3>
              <div className="grid2">
                <NumberField label={t('LEDs in series')} value={s.series} min={1} max={100} step={1} onChange={(v) => set({ series: Math.round(v) })} />
                <NumberField label={t('Parallel strings')} value={s.strings} min={1} max={1000} step={1} onChange={(v) => set({ strings: Math.round(v) })} />
              </div>
              <label className="check">
                <input type="checkbox" checked={s.shared} disabled={s.strings < 2} onChange={(e) => set({ shared: e.target.checked })} /> {t('One shared resistor for all strings')}
              </label>
            </div>
            <div className="section">
              <h3>{t('Resistor')}</h3>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="es">{t('Standard series')}</label>
                  <select id="es" value={s.eseries} onChange={(e) => set({ eseries: e.target.value as ESeries })}>
                    {E_SERIES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="rd">{t('Round to')}</label>
                  <select id="rd" value={s.rounding} onChange={(e) => set({ rounding: e.target.value as Rounding })}>
                    <option value="up">{t('Next higher (safe)')}</option>
                    <option value="nearest">{t('Nearest')}</option>
                    <option value="down">{t('Next lower')}</option>
                  </select>
                </div>
              </div>
              <div className="grid3">
                <NumberField label={t('Resistor tol.')} unit="%" value={s.resTol} min={0} max={50} onChange={(v) => set({ resTol: v })} />
                <NumberField label={t('Supply tol.')} unit="%" value={s.supplyTol} min={0} max={50} onChange={(v) => set({ supplyTol: v })} />
                <NumberField label={t('Vf spread ±')} unit="V" value={s.vfSpread} min={0} max={5} onChange={(v) => set({ vfSpread: v })} />
              </div>
            </div>
            <div className="section">
              <h3>{t('Settings')}</h3>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="lang">{t('Language')}</label>
                  <select id="lang" value={s.lang} onChange={(e) => set({ lang: e.target.value === 'uk' ? 'uk' : 'en' })}>
                    <option value="en">English</option>
                    <option value="uk">Українська</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="theme">{t('Theme')}</label>
                  <select id="theme" value={s.theme} onChange={(e) => set({ theme: e.target.value as Theme })}>
                    <option value="auto">{t('System')}</option>
                    <option value="light">{t('Light')}</option>
                    <option value="dark">{t('Dark')}</option>
                  </select>
                </div>
              </div>
              <button className="small" onClick={() => setS({ ...DEFAULT_STATE, lang: s.lang, theme: s.theme })}>
                {t('Reset values')}
              </button>
            </div>
          </div>
        </aside>
        <main className="main">
          <section className="box">
            <h3>{t('Result')}</h3>
            {d.valid ? (
              <>
                <p className={`verdict ${d.warnings.length ? 'warn' : 'ok'}`}>
                  {t('Use {0}', fmtOhm(d.r))} · {fmtFraction(d.rating ?? d.resistorPower * 2)}
                  {d.resistors > 1 ? ` × ${d.resistors}` : ''}
                </p>
                <p className="hint">
                  {d.resistors > 1 ? t('One resistor per string, {0} in total.', d.resistors) : t('A single resistor in series with the LED(s).')}
                </p>
                <table className="data">
                  <tbody>
                    <tr><td>{t('Exact value needed')}</td><td>{round(d.exactR, 2)} Ω</td></tr>
                    <tr><td>{t('Chosen {0} value', s.eseries)}</td><td>{fmtOhm(d.r)}</td></tr>
                    <tr><td>{t('Real LED current')}</td><td>{mA(d.stringCurrent)} ({pct(d.ratio)} {t('of target')})</td></tr>
                    <tr><td>{t('Worst case with tolerances')}</td><td>{mA(d.worstMin)} … {mA(d.worstMax)}</td></tr>
                    <tr><td>{t('Total supply current')}</td><td>{mA(d.totalCurrent)}</td></tr>
                    <tr><td>{t('Resistor dissipation')}</td><td>{fmtPower(d.resistorPower)}{d.resistors > 1 ? ` ${t('each')}` : ''}</td></tr>
                    <tr><td>{t('Resistor rating (2× margin)')}</td><td>{d.rating ? fmtFraction(d.rating) : t('above 10 W')}</td></tr>
                    <tr><td>{t('Power per LED')}</td><td>{fmtPower(d.ledPower)}</td></tr>
                    <tr><td>{t('Input power')}</td><td>{fmtPower(d.inputPower)}</td></tr>
                    <tr><td>{t('Efficiency')}</td><td>{pct(d.efficiency)}</td></tr>
                    <tr><td>{t('LEDs')}</td><td>{d.leds} ({series} × {s.strings})</td></tr>
                  </tbody>
                </table>
              </>
            ) : (
              <p className="verdict err">{t('No solution with these values.')}</p>
            )}
            {d.warnings.map((w) => (
              <p key={w.key} className="warn-text">{t(w.key, ...w.args)}</p>
            ))}
          </section>

          <section className="box">
            <h3>{t('Wiring diagram')}</h3>
            <Diagram series={s.series} strings={s.strings} shared={s.shared} r={d.valid ? d.r : 0} vs={s.vs} vf={s.vf} current={s.current} t={t} />
          </section>

          {d.valid && candidates.length > 1 && (
            <section className="box">
              <h3>{t('Neighbouring {0} values', s.eseries)}</h3>
              <div className="scroll">
                <table className="data">
                  <thead>
                    <tr><th>{t('Resistor')}</th><th>{t('LED current')}</th><th>{t('Brightness vs target')}</th><th>{t('Dissipation')}</th></tr>
                  </thead>
                  <tbody>
                    {candidates.map((r) => {
                      const dd = design({ ...params, rounding: 'nearest', eseries: s.eseries }, r)
                      return (
                        <tr key={r} className={r === d.r ? 'active' : ''}>
                          <td>{fmtOhm(r)}</td>
                          <td className={dd.stringCurrent > s.maxCurrent ? 'err-text' : ''}>{mA(dd.stringCurrent)}</td>
                          <td>{pct(dd.ratio)}</td>
                          <td>{fmtPower(dd.resistorPower)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="box">
            <h3>{t('Array layout optimizer')}</h3>
            <div className="row">
              <div style={{ width: 160 }}>
                <NumberField label={t('LEDs available')} value={s.total} min={1} max={500} step={1} onChange={(v) => set({ total: Math.round(v) })} />
              </div>
              <span className="hint">{t('Best ways to wire them for {0} V, ranked by LEDs used, then efficiency.', s.vs)}</span>
            </div>
            {options.length === 0 ? (
              <p className="err-text">{t('The supply cannot drive even one LED.')}</p>
            ) : (
              <div className="scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('Layout')}</th><th>{t('Resistor')}</th><th>{t('LED current')}</th><th>{t('Resistor power')}</th><th>{t('Supply current')}</th><th>{t('Efficiency')}</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {options.slice(0, 12).map((o, i) => (
                      <tr key={o.series} className={o.series === s.series && o.strings === s.strings && !s.shared ? 'active' : ''}>
                        <td>
                          {o.strings} × {o.series}
                          {i === 0 && <span className="badge">{t('best')}</span>}
                          {o.unused > 0 && <span className="hint"> · {t('{0} unused', o.unused)}</span>}
                        </td>
                        <td>{o.strings > 1 ? `${o.strings} × ` : ''}{fmtOhm(o.design.r)}</td>
                        <td>{mA(o.design.stringCurrent)}</td>
                        <td>{fmtPower(o.design.resistorPower)}</td>
                        <td>{mA(o.design.totalCurrent)}</td>
                        <td>{pct(o.design.efficiency)}</td>
                        <td><button className="small" onClick={() => set({ series: o.series, strings: o.strings, shared: false })}>{t('Use')}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="hint">{t('Layout is parallel strings × LEDs in series. More LEDs in series waste less power in the resistor.')}</p>
          </section>
        </main>
      </div>
      <p className="hint foot">
        {t('Typical values only: check the datasheet of your LED. Results are estimates.')}{' '}
        <a href="https://github.com/hermes98761234/led-resistor-calculator">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}
