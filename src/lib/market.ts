import type { IndexNow, Range } from '../../server/market'
import type { MonthRow } from './history'

export type { IndexNow, Range }

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const fetchMarketNow = () => get<IndexNow[]>('/api/market?view=now')
export const fetchIndexHistory = (id: string, range: Range) =>
  get<[number, number][]>(`/api/market?view=history&id=${encodeURIComponent(id)}&range=${range}`)
export const fetchMarketMonthly = () => get<Record<string, Record<string, number>>>('/api/market?view=monthly')

/** 지수 값 표시 */
export function indexValue(unit: IndexNow['unit'], v: number) {
  const n = (d: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d })
  if (unit === 'won') return `${n(2)}원`
  if (unit === 'usd') return `$${n(2)}`
  if (unit === 'pct') return `${n(2)}%`
  return n(2)
}

/** 전일 대비 — 금리는 %p, 나머지는 % */
export function indexChange(ix: Pick<IndexNow, 'unit' | 'change' | 'changePct'>) {
  const sign = (v: number) => (v > 0 ? '+' : '')
  if (ix.unit === 'pct') return `${sign(ix.change)}${ix.change.toFixed(2)}%p`
  return `${sign(ix.changePct)}${ix.changePct.toFixed(2)}%`
}

/* ---------- 내 수익률과 시장 비교 ---------- */

export const COMPARE = [
  { id: 'kospi', name: '코스피', color: '#eb6834', foreign: false },
  { id: 'kosdaq', name: '코스닥', color: '#e87ba4', foreign: false },
  { id: 'sp500', name: 'S&P 500', color: '#1baf7a', foreign: true },
  { id: 'nasdaq', name: '나스닥', color: '#6250d6', foreign: true },
] as const

export interface CompareResult {
  /** 'YYYY-MM' — 첫 달이 기준(0%) */
  months: string[]
  /** 내 누적 수익률(%) — 월 수익률을 이어 곱함 (넣은 돈 영향 뺌) */
  mine: number[]
  /** 지수별 누적 수익률(%) — 값이 없는 달은 null */
  indices: Record<string, (number | null)[]>
}

/**
 * 같은 기간의 내 수익률과 지수 수익률.
 * 내 수익률은 월말 기록의 월 수익률을 이어 곱한 값(시간가중)이라 중간에 넣은 돈은 수익으로 치지 않아요.
 * 해외 지수는 krw면 그달 말 원/달러 환율을 곱해 원화로 바꿔서 봐요 (환율 변화까지 포함 — 환노출 ETF와 같은 기준).
 * @param from 기준이 되는 달 (이 달 말 = 0%) — 없으면 첫 기록 달
 */
export function compareReturns(
  rows: MonthRow[],
  monthly: Record<string, Record<string, number>>,
  krw: boolean,
  from?: string,
): CompareResult | null {
  const start = rows.findIndex((r) => !from || r.month >= from)
  if (start < 0) return null
  const list = rows.slice(start)
  if (list.length < 2) return null
  const months = list.map((r) => r.month)
  const mine: number[] = [0]
  let g = 1
  for (const r of list.slice(1)) {
    g *= 1 + (r.ret ?? 0) / 100
    mine.push((g - 1) * 100)
  }
  const fx = monthly.usdkrw ?? {}
  const indices: Record<string, (number | null)[]> = {}
  for (const c of COMPARE) {
    const series = monthly[c.id] ?? {}
    const val = (m: string) => {
      const v = series[m]
      if (v == null) return null
      if (c.foreign && krw) return fx[m] != null ? v * fx[m] : null
      return v
    }
    const base = val(months[0])
    indices[c.id] = months.map((m) => {
      const v = val(m)
      return base && v != null ? (v / base - 1) * 100 : null
    })
  }
  return { months, mine, indices }
}
