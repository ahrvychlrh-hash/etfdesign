import { groupDigits, parseNumber, wonShort } from '../lib/format'

interface Props {
  id: string
  value: number
  onChange: (v: number) => void
  chips?: { label: string; amount: number }[]
  autoFocus?: boolean
  placeholder?: string
}

export function MoneyInput({ id, value, onChange, chips, autoFocus, placeholder = '0' }: Props) {
  return (
    <div className="money">
      <div className="field field--lg">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={groupDigits(value)}
          onChange={(e) => onChange(Math.min(parseNumber(e.target.value), 1e15))}
        />
        <span className="field__suffix">원</span>
      </div>
      <div className="money__meta">
        <span className="muted">{value > 0 ? wonShort(value) : ' '}</span>
        {chips && (
          <div className="chips">
            {chips.map((c) => (
              <button key={c.label} type="button" className="chip" onClick={() => onChange(value + c.amount)}>
                {c.label}
              </button>
            ))}
            {value > 0 && (
              <button type="button" className="chip chip--ghost" onClick={() => onChange(0)}>
                지우기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
