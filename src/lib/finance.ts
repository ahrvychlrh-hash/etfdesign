import type { Holding } from './types'
import { expectedBreakdown } from './expected'

export interface ProjectionPoint {
  year: number
  age: number
  value: number
  contributed: number
}

const MAX_YEARS = 60

/** 월 복리로 매년 말 예상 자산을 계산합니다. */
export function project(
  start: number,
  monthly: number,
  annualReturnPct: number,
  age: number,
  years: number,
): ProjectionPoint[] {
  const r = monthlyRate(annualReturnPct)
  const points: ProjectionPoint[] = [{ year: 0, age, value: start, contributed: start }]
  let value = start
  let contributed = start
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      value = value * (1 + r) + monthly
      contributed += monthly
    }
    points.push({ year: y, age: age + y, value, contributed })
  }
  return points
}

/** 연 수익률(%)을 같은 효과의 월 수익률로 변환 */
function monthlyRate(annualPct: number) {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1
}

/** 목표 금액까지 걸리는 개월 수. 60년 안에 불가능하면 null. */
export function monthsToTarget(
  start: number,
  monthly: number,
  annualReturnPct: number,
  target: number,
): number | null {
  if (start >= target) return 0
  const r = monthlyRate(annualReturnPct)
  let value = start
  for (let m = 1; m <= MAX_YEARS * 12; m++) {
    value = value * (1 + r) + monthly
    if (value >= target) return m
  }
  return null
}

/** 정해진 개월 안에 목표에 닿기 위해 필요한 월 투자금. */
export function requiredMonthly(start: number, annualReturnPct: number, target: number, months: number): number {
  const r = monthlyRate(annualReturnPct)
  const grown = start * Math.pow(1 + r, months)
  if (grown >= target) return 0
  const factor = r === 0 ? months : (Math.pow(1 + r, months) - 1) / r
  return (target - grown) / factor
}

/** 4% 룰: 은퇴 자산의 4%를 매년 꺼내 쓰는 방식 */
export const WITHDRAW_RATE = 0.04

/**
 * 목표 금액을 모은 뒤 4%씩 꺼내 쓸 때의 생활비.
 * 매년 초에 자산의 4%를 꺼내고 나머지가 연 수익률로 불어난다고 보면,
 * 다음 해 자산(=꺼내 쓰는 금액)은 (1 - 4%) × (1 + 수익률)배가 됩니다.
 */
export function withdrawalPlan(target: number, annualReturnPct: number) {
  const yearly = target * WITHDRAW_RATE
  const growth = (1 - WITHDRAW_RATE) * (1 + annualReturnPct / 100) - 1
  const monthlyAfter = (years: number) => (yearly * Math.pow(1 + growth, years)) / 12
  return {
    monthly: yearly / 12,
    /** 해마다 꺼내 쓰는 금액이 늘어나는 비율 (소수) */
    growth,
    nextYearMonthly: monthlyAfter(1),
    tenYearMonthly: monthlyAfter(10),
  }
}

export function holdingValue(h: Holding) {
  return h.quantity * h.currentPrice
}

export function avgPrice(h: Holding) {
  return h.quantity > 0 ? h.invested / h.quantity : 0
}

/** ETF 하나의 기대 연 수익률(%) — 산출 방식은 expected.ts 참고 */
export function expectedReturn(h: Holding, reinvest: boolean): number {
  return expectedBreakdown(h, reinvest).rate
}

/** 보유 비중으로 가중평균한 포트폴리오 기대 수익률(%). 보유 ETF가 없으면 null. */
export function portfolioReturn(holdings: Holding[], reinvest: boolean): number | null {
  let w = 0
  let sum = 0
  for (const h of holdings) {
    const v = holdingValue(h)
    if (v <= 0) continue
    w += v
    sum += expectedReturn(h, reinvest) * v
  }
  return w > 0 ? sum / w : null
}

/** 보유 수량 기준 연간 배당금(원, 세전) — 최근 12개월 실제 지급액 기준 */
export function holdingDividend(h: Holding) {
  return h.quantity * (h.stats?.divPerShare ?? 0)
}

export function annualDividend(holdings: Holding[]) {
  return holdings.reduce((s, h) => s + holdingDividend(h), 0)
}

/** 배당소득세 15.4% (일반 계좌 기준) */
export const DIVIDEND_TAX = 0.154

/** 월별 예상 배당금(원, 세전) — 최근 12개월 지급 월에 고르게 나눔 */
export function monthlyDividends(holdings: Holding[]) {
  const months = Array<number>(12).fill(0)
  for (const h of holdings) {
    const pm = h.stats?.payMonths ?? []
    if (!pm.length) continue
    const each = holdingDividend(h) / pm.length
    pm.forEach((m) => (months[m - 1] += each))
  }
  return months
}

export function portfolioSummary(holdings: Holding[]) {
  const value = holdings.reduce((s, h) => s + holdingValue(h), 0)
  const cost = holdings.reduce((s, h) => s + h.invested, 0)
  const gain = value - cost
  const gainPct = cost > 0 ? (gain / cost) * 100 : 0
  return { value, cost, gain, gainPct }
}
