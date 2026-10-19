import { useMemo, useRef, useState } from 'react'
import type { Holding, Reinvest, Snapshot } from '../lib/types'
import { ICONS } from '../lib/characters'
import { holdingValue } from '../lib/finance'
import { monthKey, monthLabel, monthRows, prevMonth, realPrincipal, reinvestTotal, yearSummaries, type MonthRow } from '../lib/history'
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
  onUpdateReinvest: (r: Reinvest) => void
  onDeleteReinvest: (id: string) => void
}

const UP = '#f04452'
const DOWN = '#3182f6'

export function History({ holdings, snapshots, reinvests, onSnapshot, onAddReinvest, onUpdateReinvest, onDeleteReinvest }: Props) {
  const rows = useMemo(() => monthRows(snapshots), [snapshots])
  const years = useMemo(() => yearSummaries(rows, reinvests), [rows, reinvests])
  const value = holdings.reduce((s, h) => s + holdingValue(h), 0)
  const principal = realPrincipal(holdings, reinvests)
  const gain = value - principal
  const recent = rows.slice(-24)
  // 원금을 아는 달만 수익률 그래프에
  const withPct = recent.filter((r) => r.gainPct != null)
  const dividendRe = reinvestTotal(reinvests, 'dividend')
  const sellRe = reinvestTotal(reinvests, 'sell')
  const reinvested = dividendRe + sellRe

  return (
    <>
      <header className="hero hero--compact">
        <div className="hero__top">
          <span className="logo">자산 기록</span>
        </div>
        <p className="hero__hello">총 원금 {wonShort(principal)}</p>
        <h1 className="hero__title">
          <b>
            {gain >= 0 ? '+' : ''}
            {wonShort(gain)}
          </b>{' '}
          ({principal > 0 ? pct((gain / principal) * 100) : '—'})
        </h1>
        <img className="hero__corner" src={ICONS.calendar} alt="" />
      </header>

      <div className="card float-row--single hist-note hist-summary">
        <span>
          <span className="muted">총 원금</span>
          <b>{wonShort(principal)}</b>
          <small className="muted">투자금 − 재투자</small>
        </span>
        <span>
          <span className="muted">평가금</span>
          <b>{wonShort(value)}</b>
        </span>
        <span>
          <span className="muted">수익금</span>
          <b className={tone(gain)}>
            {gain >= 0 ? '+' : ''}
            {wonShort(gain)}
          </b>
          <small className="muted">평가손익 + 재투자</small>
        </span>
        <span>
          <span className="muted">재투자</span>
          <b>{wonShort(reinvested)}</b>
          <small className="muted">배당 + 매도 후 재투자</small>
        </span>
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
              {withPct.length > 0 ? (
                <>
                  <div className="chart-legend">
                    <span>
                      <i className="chart-legend__bar" /> 수익률 (막대)
                    </span>
                    <span>
                      <i className="chart-legend__line" /> 수익금 (선)
                    </span>
                  </div>
                  <MonthBars
                    height={180}
                    bars={withPct.map((r) => ({
                      key: r.month,
                      month: r.month,
                      value: r.gainPct as number,
                      color: (r.gainPct as number) >= 0 ? UP : DOWN,
                      faded: r.ongoing,
                    }))}
                    line={{ values: withPct.map((r) => r.gain), format: wonAxis }}
                    format={(v) => `${v.toFixed(1)}%`}
                    tooltip={(b) => <RowTip row={recent.find((r) => r.month === b.month)!} />}
                  />
                </>
              ) : (
                <p className="muted">월별 기록에 원금이 있어야 수익률이 보여요.</p>
              )}
              <p className="hint hint--sm">
                그달 말 기준으로 넣은 원금 대비 얼마나 벌었는지예요. 빨강은 수익(+), 파랑은 손실(−), 옅은 막대는 진행 중인 이번 달이에요.
              </p>
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
                  <div className="year__grid year__grid--2">
                    <span>
                      <span className="muted">연 수익률</span>
                      <b className={tone(y.yearReturn)}>{y.months ? pct(y.yearReturn) : '—'}</b>
                    </span>
                    <span>
                      <span className="muted">수익금</span>
                      <b className={tone(y.profit)}>
                        {y.profit >= 0 ? '+' : ''}
                        {wonShort(y.profit)}
                      </b>
                      {y.reinvest !== 0 && <span className="muted year__sub">재투자 {wonShort(y.reinvest)} 포함</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="footnote">연 수익률은 그해 월 수익률을 이어서 곱한 값이에요. 수익금은 자산 증가분에서 새로 넣은 원금만 빼서, 그해 배당·매도 후 재투자한 금액도 들어 있어요. 처음 기록한 달은 그때까지 쌓인 수익도 함께 넣어요.</p>
          </Section>
        </>
      )}

      <MonthTable rows={rows} onSnapshot={onSnapshot} snapshots={snapshots} />

      <ReinvestSection reinvests={reinvests} onAdd={onAddReinvest} onUpdate={onUpdateReinvest} onDelete={onDeleteReinvest} />
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
        <b className={tone(row.gain)}>
          {row.gain >= 0 ? '+' : ''}
          {wonShort(row.gain)}
        </b>
      </div>
      <div className="tooltip__row">
        수익률 <b className={tone(row.gainPct ?? 0)}>{row.gainPct == null ? '—' : pct(row.gainPct, 2)}</b>
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
  const [savedNote, setSavedNote] = useState('')
  // 표와 입력칸은 '자세히 보기'를 누르거나 기록을 추가할 때 펼침
  const [expanded, setExpanded] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const current = monthKey()

  function open(m: string | null) {
    const s = m ? snapshots[m] : undefined
    setExpanded(true)
    setEditing(m ?? 'new')
    // 새 기록은 가장 오래된 기록의 한 달 전(없으면 지난달)부터
    setMonth(m ?? prevMonth(rows[0]?.month ?? current))
    setValue(s?.value ?? 0)
    setPrincipal(s?.principal ?? 0)
    setSavedNote('')
  }

  const valid = /^\d{4}-\d{2}$/.test(month) && value > 0
  function save() {
    if (!valid) return
    if (editing && editing !== 'new' && editing !== month) onSnapshot(editing, null)
    onSnapshot(month, { value, principal, at: new Date().toISOString(), manual: true })
    setEditing(null)
  }
  /** 저장하고 바로 그 전 달을 이어서 입력 (금액은 그대로 두고 고치기만) */
  function saveAndPrev() {
    if (!valid) return
    onSnapshot(month, { value, principal, at: new Date().toISOString(), manual: true })
    setSavedNote(`${monthLabel(month)} 저장했어요`)
    setMonth(prevMonth(month))
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
        <div className="card hist-form" ref={formRef}>
          {savedNote && <p className="hint hint--sm">✓ {savedNote}. 이어서 이전 달을 입력하세요.</p>}
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
            <span className="form-item__label">그때까지의 총 원금 (투자금 − 재투자)</span>
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
            {editing === 'new' && (
              <button className="btn btn--ghost btn--sm" disabled={!valid} onClick={saveAndPrev}>
                저장 후 이전 달
              </button>
            )}
            <button className="btn btn--primary btn--sm" disabled={!valid} onClick={save}>
              저장
            </button>
          </div>
        </div>
      )}

      {expanded && rows.length > 0 && (
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
                    <td className={`num ${tone(r.gain)}`}>
                      {r.gain >= 0 ? '+' : ''}
                      {wonShort(r.gain)}
                    </td>
                    <td className={`num ${tone(r.gainPct ?? 0)}`}>{r.gainPct == null ? '—' : pct(r.gainPct, 2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {expanded && rows.length > 0 && <p className="footnote">줄을 누르면 그 달 기록을 고칠 수 있어요.</p>}
      {rows.length > 0 && (
        <button
          className="card card--btn hist-toggle"
          onClick={() => {
            setExpanded((o) => !o)
            setEditing(null)
          }}
          aria-expanded={expanded}
        >
          {expanded ? '접기 ▴' : `월별 기록 ${rows.length}개월 자세히 보기 ▾`}
        </button>
      )}
    </Section>
  )
}

/* ---------------- 재투자 기록 ---------------- */

const KIND_LABEL: Record<Reinvest['kind'], string> = { sell: '매도 후 재투자', dividend: '배당 재투자' }

function ReinvestSection({
  reinvests,
  onAdd,
  onUpdate,
  onDelete,
}: {
  reinvests: Reinvest[]
  onAdd: (r: Reinvest) => void
  onUpdate: (r: Reinvest) => void
  onDelete: (id: string) => void
}) {
  const [month, setMonth] = useState(monthKey())
  const [kind, setKind] = useState<Reinvest['kind']>('dividend')
  const [amount, setAmount] = useState(0)
  const [memo, setMemo] = useState('')
  /** 매도 후 재투자에서 손실을 봤는지 — 손실이면 마이너스 금액으로 저장 */
  const [loss, setLoss] = useState(false)
  /** 수정 중인 기록 id — 있으면 위 입력칸이 수정 폼이 됨 */
  const [editingId, setEditingId] = useState<string | null>(null)
  // 입력칸은 '재투자 기록 추가'를 눌러야, 목록은 '자세히 보기'를 눌러야 보여줌
  const [formOpen, setFormOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const byMonth = new Map<string, Reinvest[]>()
  ;[...reinvests]
    .sort((a, b) => b.month.localeCompare(a.month))
    .forEach((r) => byMonth.set(r.month, [...(byMonth.get(r.month) ?? []), r]))

  function save() {
    if (amount <= 0 || !/^\d{4}-\d{2}$/.test(month)) return
    const signed = kind === 'sell' && loss ? -amount : amount
    const r = { id: editingId ?? crypto.randomUUID(), month, kind, amount: signed, memo: memo.trim() || undefined }
    if (editingId) onUpdate(r)
    else onAdd(r)
    reset()
  }
  function reset() {
    setEditingId(null)
    setAmount(0)
    setMemo('')
    setLoss(false)
    setFormOpen(false)
  }
  function openForm() {
    setFormOpen(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }
  function edit(r: Reinvest) {
    openForm()
    setEditingId(r.id)
    setMonth(r.month)
    setKind(r.kind)
    setAmount(Math.abs(r.amount))
    setLoss(r.amount < 0)
    setMemo(r.memo ?? '')
  }

  return (
    <Section
      title="재투자 기록"
      action={
        <button
          className="link"
          onClick={() => {
            reset()
            setMonth(monthKey())
            openForm()
          }}
        >
          + 재투자 기록 추가
        </button>
      }
    >
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

        {formOpen && (
        <div className="reinv-form" ref={formRef}>
          <div className="chips">
            {(['dividend', 'sell'] as const).map((k) => (
              <button key={k} type="button" className={`chip chip--select ${kind === k ? 'is-on' : ''}`} onClick={() => setKind(k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          {kind === 'sell' && (
            <div className="chips">
              <button type="button" className={`chip chip--select ${!loss ? 'is-on' : ''}`} onClick={() => setLoss(false)}>
                수익 (+)
              </button>
              <button type="button" className={`chip chip--select ${loss ? 'is-on' : ''}`} onClick={() => setLoss(true)}>
                손실 (−)
              </button>
            </div>
          )}
          <div className="reinv-form__row">
            <div className="field field--month">
              <input type="month" aria-label="월" value={month} max={monthKey()} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="field">
              <input placeholder="메모 (선택)" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
          <MoneyInput id="reinvest-amount" value={amount} onChange={setAmount} />
          {kind === 'sell' && loss && amount > 0 && <p className="hint hint--sm tone-down">−{won(amount)} 손실로 저장돼요.</p>}
          <button className="btn btn--primary btn--block" disabled={amount <= 0} onClick={save}>
            {editingId ? '수정 저장' : '재투자 추가'}
          </button>
          <button className="btn btn--ghost btn--block" onClick={reset}>
            {editingId ? '수정 취소' : '취소'}
          </button>
          <p className="hint hint--sm">
            재투자한 돈은 내 원금이 아니라서 투자금에서 빼고 실제 수익률을 계산해요. 판 ETF를 목록에서 지웠다면 판 금액 중 수익
            부분만 적고, 손해를 보고 팔았다면 '손실'을 골라 손실 금액을 적으면 원금에 다시 더해서 계산해요.
          </p>
        </div>
        )}

        {listOpen && byMonth.size > 0 && (
          <div className="reinv-list">
            {[...byMonth.entries()].map(([m, list]) => (
              <div key={m} className="reinv-month">
                <div className="reinv-month__head">
                  <b>{monthLabel(m)}</b>
                  <span className="muted">{won(list.reduce((s, r) => s + r.amount, 0))}</span>
                </div>
                {list.map((r) => (
                  <div key={r.id} className={`reinv-item ${editingId === r.id ? 'is-editing' : ''}`}>
                    <span className={`tag tag--xs ${r.kind === 'sell' ? 'tag--warn' : 'tag--blue'}`}>{KIND_LABEL[r.kind]}</span>
                    <span className="reinv-item__memo">{r.memo ?? ''}</span>
                    <b className={r.amount < 0 ? 'tone-down' : undefined}>{won(r.amount)}</b>
                    <button className="link" onClick={() => edit(r)}>
                      수정
                    </button>
                    <ConfirmButton
                      className="link link--danger"
                      label="삭제"
                      question="삭제할까요?"
                      confirmLabel="삭제"
                      onConfirm={() => {
                        if (editingId === r.id) reset()
                        onDelete(r.id)
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {reinvests.length > 0 && (
          <button className="share__more" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen}>
            {listOpen ? '접기 ▴' : `재투자 기록 ${reinvests.length}개 자세히 보기 ▾`}
          </button>
        )}
      </div>
    </Section>
  )
}
