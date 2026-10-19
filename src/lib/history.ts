import type { Holding, Reinvest, Snapshot } from './types'

/** 'YYYY-MM' (한국 시간 기준) */
export function monthKey(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 3600_000)
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM'의 한 달 전 */
export function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}

export function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return `${y}년 ${Number(m)}월`
}

/** 재투자 합계 (원금이 아닌 돈) */
export function reinvestTotal(reinvests: Reinvest[], kind?: Reinvest['kind']) {
  return reinvests.filter((r) => !kind || r.kind === kind).reduce((s, r) => s + r.amount, 0)
}

/** 실제 원금 = 보유 ETF 투자금 합계 - 재투자 합계 */
export function realPrincipal(holdings: Holding[], reinvests: Reinvest[]) {
  const invested = holdings.reduce((s, h) => s + h.invested, 0)
  return Math.max(invested - reinvestTotal(reinvests), 0)
}

export interface MonthRow {
  month: string
  value: number
  principal: number
  /** 이번 달 새로 넣은 원금 (재투자 제외) */
  newMoney: number | null
  /** 이번 달 수익금 = 월말 자산 - 지난달 월말 자산 - 새로 넣은 원금 */
  profit: number | null
  /** 이번 달 수익률 (%) */
  ret: number | null
  /** 그달 말 기준 총 수익금 = 월말 자산 - 그때까지 넣은 원금 */
  gain: number
  /** 그달 말 기준 원금 대비 수익률 (%) — 원금을 모르면 null */
  gainPct: number | null
  /** 아직 끝나지 않은 이번 달 */
  ongoing: boolean
  manual?: boolean
}

/**
 * 월별 기록을 시간순으로 정리하고 수익금·수익률을 계산합니다.
 * 수익률은 새로 넣은 돈이 달 중간에 들어왔다고 보고
 * 수익금 ÷ (지난달 자산 + 새로 넣은 돈의 절반)으로 계산합니다(수정 디츠 방식).
 */
export function monthRows(snapshots: Record<string, Snapshot>, now = new Date()): MonthRow[] {
  const current = monthKey(now)
  const keys = Object.keys(snapshots).sort()
  return keys.map((month, i) => {
    const s = snapshots[month]
    const prev = i > 0 ? snapshots[keys[i - 1]] : null
    let newMoney: number | null = null
    let profit: number | null = null
    let ret: number | null = null
    if (prev) {
      newMoney = s.principal - prev.principal
      profit = s.value - prev.value - newMoney
      const base = prev.value + newMoney / 2
      ret = base > 0 ? (profit / base) * 100 : null
    }
    const gain = s.value - s.principal
    const gainPct = s.principal > 0 ? (gain / s.principal) * 100 : null
    return {
      month,
      value: s.value,
      principal: s.principal,
      newMoney,
      profit,
      ret,
      gain,
      gainPct,
      ongoing: month === current,
      manual: s.manual,
    }
  })
}

export interface YearSummary {
  year: string
  /** 월 수익률을 이어서 곱한 연 수익률 (%) */
  yearReturn: number
  /** 그해 수익금 — 재투자는 원금이 아니라서 이미 여기에 들어 있음 */
  profit: number
  /** 그해 재투자 기록 합계 (수익금 안에 포함된 금액) */
  reinvest: number
  endValue: number
  months: number
  ongoing: boolean
}

/**
 * 연도별 수익률·수익금. 맨 처음 기록한 달은 지난달 기록이 없으니
 * 그때까지 쌓인 수익(월말 자산 - 원금)을 그달 수익으로 봐서, 기록 전체 수익금이 총 수익금과 맞게 함.
 */
export function yearSummaries(rows: MonthRow[], reinvests: Reinvest[] = []): YearSummary[] {
  const first = rows[0]
  const profitOf = (r: MonthRow) => (r === first ? r.gain : (r.profit ?? 0))
  const retOf = (r: MonthRow) => (r === first ? r.gainPct : r.ret)
  const byYear = new Map<string, MonthRow[]>()
  for (const r of rows) {
    const y = r.month.slice(0, 4)
    byYear.set(y, [...(byYear.get(y) ?? []), r])
  }
  return [...byYear.entries()]
    .map(([year, list]) => {
      const withRet = list.filter((r) => retOf(r) != null)
      const growth = withRet.reduce((g, r) => g * (1 + (retOf(r) as number) / 100), 1)
      return {
        year,
        yearReturn: (growth - 1) * 100,
        profit: list.reduce((s, r) => s + profitOf(r), 0),
        reinvest: reinvestTotal(reinvests.filter((r) => r.month.startsWith(year))),
        endValue: list[list.length - 1].value,
        months: withRet.length,
        ongoing: list.some((r) => r.ongoing),
      }
    })
    .sort((a, b) => b.year.localeCompare(a.year))
}
