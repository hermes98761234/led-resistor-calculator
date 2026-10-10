import { useId, useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  unit?: string
  min?: number
  max?: number
  step?: number
  hint?: string
}

/** Number input that lets you type freely ("2.") and only commits valid, in-range values. */
export default function NumberField({ label, value, onChange, unit, min = 0, max = Infinity, step, hint }: Props) {
  const id = useId()
  const [text, setText] = useState(String(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    // The value changed from outside (example, reset): show it, unless the text already means the same number.
    setPrev(value)
    if (Number(text) !== value) setText(String(value))
  }
  const n = Number(text)
  const bad = text.trim() === '' || !Number.isFinite(n) || n < min || n > max
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {unit ? ` (${unit})` : ''}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        step={step ?? 'any'}
        className={bad ? 'bad' : undefined}
        aria-invalid={bad}
        onChange={(e) => {
          setText(e.target.value)
          const v = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= min && v <= max) onChange(v)
        }}
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}
