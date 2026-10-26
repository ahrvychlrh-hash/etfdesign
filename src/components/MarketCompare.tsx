import { useEffect, useMemo, useState } from 'react'
import type { MonthRow } from '../lib/history'
import { COMPARE, compareReturns, fetchMarketMonthly } from '../lib/market'
import { LineChart } from './LineChart'
import { Section, Toggle } from './ui'

const MINE = '#3d5afe'

/** 기록 탭: 같은 기간 내 수익률 vs 코스피·코스닥·S&P500·나스닥 */
export function MarketCompare({ rows }: { rows: MonthRow[] }) {
  const [monthly, setMonthly] = useState<Record<string, Record<string, number>> | null>(null)
  const [failed, setFailed] = useState(false)
  const [period, setPeriod] = useState<'all' | 'year' | '1y'>('all')
  const [krw, setKrw] = useState(true)

  useEffect(() => {
    fetchMarketMonthly()
      .then(setMonthly)
      .catch(() => setFailed(true))
  }, [])

  // 기간의 기준 달 (그 달 말 = 0%)
  const from = useMemo(() => {
    if (period === 'all' || !rows.length) return undefined
    const last = rows[rows.length - 1].month
    const [y, m] = last.split('-').map(Number)
    if (period === 'year') return `${y - 1}-12`
    return `${y - 1}-${String(m).padStart(2, '0')}`
  }, [period, rows])

  const result = useMemo(() => {
    if (!monthly) return null
    // 기준 달 기록이 없으면 그 뒤 첫 기록부터
    return compareReturns(rows, monthly, krw, from)
  }, [rows, monthly, krw, from])

  const enough = rows.length >= 2

  return (
    <Section title="시장과 비교">
      <div className="card compare">
        <div className="chips compare__periods">
          {(
            [
              ['all', '전체'],
              ['year', '올해'],
              ['1y', '최근 1년'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`chip chip--select chip--sm ${period === id ? 'is-on' : ''}`} onClick={() => setPeriod(id)}>
              {label}
            </button>
          ))}
        </div>

        {!enough && <p className="muted compare__empty">월말 기록이 2개월 이상 쌓이면 시장과 비교할 수 있어요.</p>}
        {enough && !monthly && !failed && <p className="muted compare__empty">지수를 불러오는 중…</p>}
        {enough && failed && <p className="muted compare__empty">지수를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>}
        {enough && monthly && !result && <p className="muted compare__empty">이 기간에는 기록이 2개월 이상 없어요.</p>}

        {result && (
          <>
            <p className="compare__range muted">
              {label(result.months[0])} 말 → {label(result.months[result.months.length - 1])}
              {rows[rows.length - 1].ongoing ? ' (이번 달은 지금까지)' : ''}
            </p>
            <Ranking result={result} />
            <div className="compare__chart">
              <LineChart
                series={[
                  { name: '내 수익률', color: MINE, values: result.mine, bold: true },
                  ...COMPARE.map((c) => ({ name: c.name, color: c.color, values: result.indices[c.id] })),
                ]}
                labels={result.months.map(label)}
                ticks={result.months.map((m, i) => (i === 0 || i === result.months.length - 1 || m.endsWith('-01') ? short(m) : ''))}
                format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}%`}
                zeroLine
                height={210}
              />
            </div>
            <div className="compare__krw">
              <span>
                <b>해외 지수 원화로 보기</b>
                <span className="muted">환율 변화까지 포함해요 (환노출 해외 ETF와 같은 기준)</span>
              </span>
              <Toggle on={krw} onChange={setKrw} label="해외 지수 원화로 보기" />
            </div>
          </>
        )}
        <p className="footnote">
          내 수익률은 월말 기록의 월 수익률을 이어 곱한 값이라 중간에 넣은 돈은 수익으로 치지 않아요. 지수는 배당을 뺀 가격 기준이에요.
        </p>
      </div>
    </Section>
  )
}

function label(m: string) {
  const [y, mo] = m.split('-')
  return `${y}년 ${Number(mo)}월`
}
function short(m: string) {
  const [y, mo] = m.split('-')
  return mo === '01' ? `${y}` : `${Number(mo)}월`
}

/** 마지막 달 기준 순위 — 내 수익률과의 차이 */
function Ranking({ result }: { result: NonNullable<ReturnType<typeof compareReturns>> }) {
  const lastOf = (v: (number | null)[]) => {
    for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return v[i]
    return null
  }
  const mine = result.mine[result.mine.length - 1]
  const list = [
    { name: '내 수익률', color: MINE, v: mine, me: true },
    ...COMPARE.map((c) => ({ name: c.name, color: c.color, v: lastOf(result.indices[c.id]), me: false })),
  ]
    .filter((x): x is { name: string; color: string; v: number; me: boolean } => x.v != null)
    .sort((a, b) => b.v - a.v)
  const fmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
  return (
    <ul className="compare__rank">
      {list.map((x, i) => (
        <li key={x.name} className={x.me ? 'is-me' : ''}>
          <span className="compare__no">{i + 1}</span>
          <i className="legend__swatch" style={{ background: x.color }} />
          <span className="compare__name">{x.name}</span>
          <b className={x.v > 0 ? 'tone-up' : x.v < 0 ? 'tone-down' : ''}>{fmt(x.v)}</b>
          {!x.me && (
            <small className="muted compare__gap">
              {mine - x.v >= 0 ? `내가 ${(mine - x.v).toFixed(1)}%p 앞섬` : `내가 ${(x.v - mine).toFixed(1)}%p 뒤짐`}
            </small>
          )}
        </li>
      ))}
    </ul>
  )
}
