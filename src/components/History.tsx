import { useMemo, useState } from 'react'
import type { Holding, Reinvest, Snapshot } from '../lib/types'
import { ICONS } from '../lib/characters'
import { holdingValue } from '../lib/finance'
import { monthKey, monthLabel, monthRows, realPrincipal, reinvestTotal, yearSummaries, type MonthRow } from '../lib/history'
import { pct, won, wonShort, wonAxis } from '../lib/format'
import { MoneyInput } from './MoneyInput'
import { MonthBars } from './MonthBars'
import { ConfirmButton, Section } from './ui'

interface Props {
  holdings: Holding[]
  snapshots: Record<string, Snapshot>
  reinvests: Reinvest[]
  onSnapshot: (month: string, snap: Snapshot | null) => void
  onAddReinvest: (r: Reinvest) => void
  onDeleteReinvest: (id: string) => void
}

const UP = '#f04452'
const DOWN = '#3182f6'

export function History({ holdings, snapshots, reinvests, onSnapshot, onAddReinvest, onDeleteReinvest }: Props) {
  const rows = useMemo(() => monthRows(snapshots), [snapshots])
  const years = useMemo(() => yearSummaries(rows), [rows])
  const value = holdings.reduce((s, h) => s + holdingValue(h), 0)
  const principal = realPrincipal(holdings, reinvests)
  const gain = value - principal
  const recent = rows.slice(-24)

  return (
    <>
      <header className="hero hero--compact">
        <div className="hero__top">
          <span className="logo">자산 기록</span>
        </div>
        <p className="hero__hello">실제 원금 {wonShort(principal)} 대비</p>
        <h1 className="hero__title">
          <b>
            {gain >= 0 ? '+' : ''}
            {wonShort(gain)}
          </b>{' '}
          ({principal > 0 ? pct((gain / principal) * 100) : '—'})
        </h1>
        <p className="hero__meta">재투자한 {wonShort(reinvestTotal(reinvests))}은 원금에서 빼고 계산했어요</p>
        <img className="hero__corner" src={ICONS.calendar} alt="" />
      </header>

      <div className="card float-row--single hist-note">
        매달 앱을 연 마지막 시점의 자산이 그 달의 월말 기록이 돼요. 지난 기록은 아래에서 직접 넣거나 고칠 수 있어요.
      </div>

      {rows.length === 0 ? (
        <div className="stack stack--gap">
          <div className="card empty">
            <img src={ICONS.seedling} alt="" className="icon3d" />
            <b>아직 기록이 없어요</b>
            <span className="muted">ETF를 등록하면 이번 달부터 자동으로 기록돼요</span>
          </div>
        </div>
      ) : (
        <>
          <Section title="월말 자산">
            <div className="card">
              <MonthBars
                bars={recent.map((r) => ({ key: r.month, month: r.month, value: r.value, faded: r.ongoing }))}
                format={wonAxis}
                tooltip={(b) => <RowTip row={recent.find((r) => r.month === b.month)!} />}
              />
            </div>
          </Section>

          <Section title="월 수익률">
            <div className="card">
              {recent.some((r) => r.ret != null) ? (
                <MonthBars
                  height={160}
                  bars={recent
                    .filter((r) => r.ret != null)
                    .map((r) => ({
                      key: r.month,
                      month: r.month,
                      value: r.ret as number,
                      color: (r.ret as number) >= 0 ? UP : DOWN,
                      faded: r.ongoing,
                    }))}
                  format={(v) => `${v.toFixed(1)}%`}
                  tooltip={(b) => <RowTip row={recent.find((r) => r.month === b.month)!} />}
                />
              ) : (
                <p className="muted">두 달 이상 기록이 쌓이면 월 수익률이 보여요.</p>
              )}
              <p className="hint hint--sm">빨강은 수익(+), 파랑은 손실(−)이에요. 옅은 막대는 아직 진행 중인 이번 달이에요.</p>
            </div>
          </Section>

          <Section title="연도별 수익률">
            <div className="year-list">
              {years.map((y) => (
                <div key={y.year} className="card year">
                  <div className="year__head">
                    <b>{y.year}년</b>
                    {y.ongoing && <span className="tag tag--xs">진행 중</span>}
                    <span className="muted">{y.months}개월 기준</span>
                  </div>
                  <div className="year__grid">
                    <span>
                      <span className="muted">연 수익률</span>
                      <b className={tone(y.yearReturn)}>{y.months ? pct(y.yearReturn) : '—'}</b>
                    </span>
                    <span>
                      <span className="muted">월 평균</span>
                      <b className={tone(y.avgMonthly)}>{y.months ? pct(y.avgMonthly, 2) : '—'}</b>
                    </span>
                    <span>
                      <span className="muted">수익금</span>
                      <b className={tone(y.profit)}>
                        {y.profit >= 0 ? '+' : ''}
                        {wonShort(y.profit)}
                      </b>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="footnote">연 수익률은 그해 월 수익률을 이어서 곱한 값이에요. 새로 넣은 돈과 재투자는 수익에서 빼고 계산해요.</p>
          </Section>
        </>
      )}

      <MonthTable rows={rows} onSnapshot={onSnapshot} snapshots={snapshots} />

      <ReinvestSection reinvests={reinvests} onAdd={onAddReinvest} onDelete={onDeleteReinvest} />
    </>
  )
}

function tone(v: number) {
  return v > 0 ? 'tone-up' : v < 0 ? 'tone-down' : ''
}

function RowTip({ row }: { row: MonthRow }) {
  return (
    <>
      <div className="tooltip__title">
        {monthLabel(row.month)}
        {row.ongoing ? ' (진행 중)' : ''}
      </div>
      <div className="tooltip__row">
        월말 자산 <b>{wonShort(row.value)}</b>
      </div>
      <div className="tooltip__row">
        수익금{' '}
        <b className={tone(row.profit ?? 0)}>
          {row.profit == null ? '—' : `${row.profit >= 0 ? '+' : ''}${wonShort(row.profit)}`}
        </b>
      </div>
      <div className="tooltip__row">
        수익률 <b className={tone(row.ret ?? 0)}>{row.ret == null ? '—' : pct(row.ret, 2)}</b>
      </div>
    </>
  )
}

/* ---------------- 월별 표 + 지난 기록 입력 ---------------- */

function MonthTable({
  rows,
  snapshots,
  onSnapshot,
}: {
  rows: MonthRow[]
  snapshots: Record<string, Snapshot>
  onSnapshot: Props['onSnapshot']
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [month, setMonth] = useState('')
  const [value, setValue] = useState(0)
  const [principal, setPrincipal] = useState(0)
  const current = monthKey()

  function open(m: string | null) {
    const s = m ? snapshots[m] : undefined
    setEditing(m ?? 'new')
    setMonth(m ?? '')
    setValue(s?.value ?? 0)
    setPrincipal(s?.principal ?? 0)
  }
  function save() {
    if (!/^\d{4}-\d{2}$/.test(month) || value <= 0) return
    if (editing && editing !== 'new' && editing !== month) onSnapshot(editing, null)
    onSnapshot(month, { value, principal, at: new Date().toISOString(), manual: true })
    setEditing(null)
  }

  return (
    <Section
      title="월별 기록"
      action={
        <button className="link" onClick={() => open(null)}>
          + 지난 달 기록 추가
        </button>
      }
    >
      {editing && (
        <div className="card hist-form">
          <label className="form-item">
            <span className="form-item__label">월</span>
            <div className="field">
              <input type="month" value={month} max={current} onChange={(e) => setMonth(e.target.value)} />
            </div>
          </label>
          <div className="form-item">
            <span className="form-item__label">월말 평가금</span>
            <MoneyInput id="snap-value" value={value} onChange={setValue} />
          </div>
          <div className="form-item">
            <span className="form-item__label">그때까지 넣은 실제 원금 (재투자 제외)</span>
            <MoneyInput id="snap-principal" value={principal} onChange={setPrincipal} />
          </div>
          <div className="row-end">
            {editing !== 'new' && (
              <ConfirmButton
                className="btn btn--danger btn--sm"
                label="삭제"
                question="이 달 기록을 지울까요?"
                confirmLabel="삭제"
                onConfirm={() => {
                  onSnapshot(editing, null)
                  setEditing(null)
                }}
              />
            )}
            <button className="btn btn--ghost btn--sm" onClick={() => setEditing(null)}>
              취소
            </button>
            <button className="btn btn--primary btn--sm" disabled={!/^\d{4}-\d{2}$/.test(month) || value <= 0} onClick={save}>
              저장
            </button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card hist-table-wrap">
          <table className="hist-table">
            <thead>
              <tr>
                <th>월</th>
                <th className="num">월말 자산</th>
                <th className="num">수익금</th>
                <th className="num">수익률</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r, i, arr) => {
                const yearBreak = i > 0 && arr[i - 1].month.slice(0, 4) !== r.month.slice(0, 4)
                return (
                  <tr key={r.month} className={yearBreak ? 'is-year' : ''} onClick={() => open(r.month)}>
                    <td>
                      {monthLabel(r.month).replace(/^\d{4}년 /, `'${r.month.slice(2, 4)}. `)}
                      {r.ongoing && <span className="tag tag--xs">진행 중</span>}
                      {r.manual && <span className="tag tag--xs tag--warn">직접</span>}
                    </td>
                    <td className="num">{wonShort(r.value)}</td>
                    <td className={`num ${tone(r.profit ?? 0)}`}>
                      {r.profit == null ? '—' : `${r.profit >= 0 ? '+' : ''}${wonShort(r.profit)}`}
                    </td>
                    <td className={`num ${tone(r.ret ?? 0)}`}>{r.ret == null ? '—' : pct(r.ret, 2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="footnote">줄을 누르면 그 달 기록을 고칠 수 있어요.</p>
    </Section>
  )
}

/* ---------------- 재투자 기록 ---------------- */

const KIND_LABEL: Record<Reinvest['kind'], string> = { sell: '매도 후 재투자', dividend: '배당 재투자' }

function ReinvestSection({
  reinvests,
  onAdd,
  onDelete,
}: {
  reinvests: Reinvest[]
  onAdd: (r: Reinvest) => void
  onDelete: (id: string) => void
}) {
  const [month, setMonth] = useState(monthKey())
  const [kind, setKind] = useState<Reinvest['kind']>('dividend')
  const [amount, setAmount] = useState(0)
  const [memo, setMemo] = useState('')
  const byMonth = new Map<string, Reinvest[]>()
  ;[...reinvests]
    .sort((a, b) => b.month.localeCompare(a.month))
    .forEach((r) => byMonth.set(r.month, [...(byMonth.get(r.month) ?? []), r]))

  function add() {
    if (amount <= 0 || !/^\d{4}-\d{2}$/.test(month)) return
    onAdd({ id: crypto.randomUUID(), month, kind, amount, memo: memo.trim() || undefined })
    setAmount(0)
    setMemo('')
  }

  return (
    <Section title="재투자 기록">
      <div className="card">
        <div className="div__grid div__grid--2">
          <span>
            <span className="muted">매도 후 재투자 합계</span>
            <b>{won(reinvestTotal(reinvests, 'sell'))}</b>
          </span>
          <span>
            <span className="muted">배당 재투자 합계</span>
            <b>{won(reinvestTotal(reinvests, 'dividend'))}</b>
          </span>
        </div>

        <div className="reinv-form">
          <div className="chips">
            {(['dividend', 'sell'] as const).map((k) => (
              <button key={k} type="button" className={`chip chip--select ${kind === k ? 'is-on' : ''}`} onClick={() => setKind(k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="reinv-form__row">
            <div className="field field--month">
              <input type="month" aria-label="월" value={month} max={monthKey()} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="field">
              <input placeholder="메모 (선택)" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
          <MoneyInput id="reinvest-amount" value={amount} onChange={setAmount} />
          <button className="btn btn--primary btn--block" disabled={amount <= 0} onClick={add}>
            재투자 추가
          </button>
          <p className="hint hint--sm">
            재투자한 돈은 내 원금이 아니라서 투자금에서 빼고 실제 수익률을 계산해요. 판 ETF를 목록에서 지웠다면 판 금액 중 수익
            부분만 적어야 정확해요.
          </p>
        </div>

        {byMonth.size > 0 && (
          <div className="reinv-list">
            {[...byMonth.entries()].map(([m, list]) => (
              <div key={m} className="reinv-month">
                <div className="reinv-month__head">
                  <b>{monthLabel(m)}</b>
                  <span className="muted">{won(list.reduce((s, r) => s + r.amount, 0))}</span>
                </div>
                {list.map((r) => (
                  <div key={r.id} className="reinv-item">
                    <span className={`tag tag--xs ${r.kind === 'sell' ? 'tag--warn' : 'tag--blue'}`}>{KIND_LABEL[r.kind]}</span>
                    <span className="reinv-item__memo">{r.memo ?? ''}</span>
                    <b>{won(r.amount)}</b>
                    <ConfirmButton className="link link--danger" label="삭제" question="삭제할까요?" confirmLabel="삭제" onConfirm={() => onDelete(r.id)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
