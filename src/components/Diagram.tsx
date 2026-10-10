import { fmtOhm } from '../lib/led'
import type { T } from '../i18n'

interface Props {
  series: number
  strings: number
  shared: boolean
  r: number
  vs: number
  vf: number
  current: number
  t: T
}

const MAX_STRINGS = 4
const MAX_LEDS = 4
const GAP = 96
const RES_H = 44
const LED_H = 36

function Resistor({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 8} />
      <rect x={x - 8} y={y + 8} width={16} height={28} fill="var(--panel)" />
      <line x1={x} y1={y + 36} x2={x} y2={y + RES_H} />
      <text x={x + 14} y={y + 27} className="dg-label">{label}</text>
    </g>
  )
}

function Led({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 8} />
      <polygon points={`${x - 9},${y + 8} ${x + 9},${y + 8} ${x},${y + 25}`} fill="var(--panel2)" />
      <line x1={x - 9} y1={y + 25} x2={x + 9} y2={y + 25} />
      <line x1={x} y1={y + 25} x2={x} y2={y + LED_H} />
      <g className="dg-arrow">
        <line x1={x + 12} y1={y + 10} x2={x + 20} y2={y + 2} />
        <line x1={x + 17} y1={y + 18} x2={x + 25} y2={y + 10} />
        <polyline points={`${x + 15},${y + 2} ${x + 20},${y + 2} ${x + 20},${y + 7}`} />
        <polyline points={`${x + 20},${y + 10} ${x + 25},${y + 10} ${x + 25},${y + 15}`} />
      </g>
    </g>
  )
}

/** Wiring diagram: a +V rail, one or more strings of resistor and LEDs, and ground. */
export default function Diagram({ series, strings, shared, r, vs, vf, current, t }: Props) {
  const showS = Math.min(strings, MAX_STRINGS)
  const showL = Math.min(series, MAX_LEDS)
  const cutS = strings > showS
  const cutL = series > showL
  const cols = showS + (cutS ? 1 : 0)
  const sharedOn = shared && strings > 1
  const top = 46
  const resTop = top
  const ledTop = sharedOn ? top + RES_H + 22 : top + RES_H
  const ledsH = showL * LED_H + (cutL ? 26 : 0)
  const gnd = ledTop + ledsH + 18
  const height = gnd + 46
  const width = Math.max(300, cols * GAP + 90)
  const x0 = (width - (cols - 1) * GAP) / 2
  const xs = Array.from({ length: cols }, (_, i) => x0 + i * GAP)
  const strX = xs.slice(0, showS)
  const mid = sharedOn ? (strX[0] + strX[strX.length - 1]) / 2 : 0
  const label = fmtOhm(r)
  const ledLabel = `${vf} V`

  const stringBody = (x: number) => (
    <g key={x}>
      {!sharedOn && <Resistor x={x} y={resTop} label={label} />}
      {Array.from({ length: showL }, (_, k) => (
        <Led key={k} x={x} y={ledTop + k * LED_H} />
      ))}
      {cutL && (
        <g>
          <line x1={x} y1={ledTop + showL * LED_H} x2={x} y2={gnd} strokeDasharray="3 3" />
          <text x={x + 8} y={ledTop + showL * LED_H + 16} className="dg-label">{t('+ {0} more', series - showL)}</text>
        </g>
      )}
      <line x1={x} y1={ledTop + ledsH} x2={x} y2={gnd} />
    </g>
  )

  return (
    <svg className="diagram" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('Wiring diagram')} style={{ maxWidth: Math.max(width, 360) }}>
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {/* rail */}
        {sharedOn ? (
          <>
            <line x1={mid - 40} y1={top - 8} x2={mid + 40} y2={top - 8} />
            <line x1={mid} y1={top - 8} x2={mid} y2={resTop} />
            <Resistor x={mid} y={resTop} label={label} />
            <line x1={mid} y1={resTop + RES_H} x2={mid} y2={resTop + RES_H + 22} />
            <line x1={strX[0]} y1={resTop + RES_H + 22} x2={cutS ? xs[cols - 1] : strX[strX.length - 1]} y2={resTop + RES_H + 22} />
            <circle cx={mid} cy={resTop + RES_H + 22} r={3.5} fill="currentColor" />
          </>
        ) : (
          <line x1={xs[0]} y1={top - 8} x2={xs[cols - 1]} y2={top - 8} />
        )}
        {!sharedOn && strX.map((x) => <line key={x} x1={x} y1={top - 8} x2={x} y2={resTop} />)}
        {strX.map(stringBody)}
        {cutS && (
          <g>
            <text x={xs[cols - 1]} y={(top + gnd) / 2} textAnchor="middle" className="dg-big" stroke="none" fill="currentColor">⋯</text>
            <text x={xs[cols - 1]} y={(top + gnd) / 2 + 20} textAnchor="middle" className="dg-label" stroke="none" fill="currentColor">
              {t('{0} strings', strings)}
            </text>
          </g>
        )}
        {/* ground */}
        <line x1={xs[0]} y1={gnd} x2={xs[cols - 1]} y2={gnd} />
        <line x1={width / 2} y1={gnd} x2={width / 2} y2={gnd + 8} />
        <line x1={width / 2 - 12} y1={gnd + 8} x2={width / 2 + 12} y2={gnd + 8} />
        <line x1={width / 2 - 7} y1={gnd + 14} x2={width / 2 + 7} y2={gnd + 14} />
        <line x1={width / 2 - 3} y1={gnd + 20} x2={width / 2 + 3} y2={gnd + 20} />
      </g>
      <text x={xs[0] - 24} y={top - 14} className="dg-label dg-strong" fill="currentColor">+{vs} V</text>
      <text x={width / 2 + 18} y={gnd + 24} className="dg-label" fill="currentColor">0 V</text>
      <text x={width - 8} y={height - 6} textAnchor="end" className="dg-label" fill="currentColor">
        {t('{0} LED · {1} mA', ledLabel, current)}
      </text>
    </svg>
  )
}
