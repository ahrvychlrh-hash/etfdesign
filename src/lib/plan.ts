import type { Holding, Profile } from './types'
import { annualDividend, monthsToTarget, portfolioReturn, portfolioSummary } from './finance'

/** 화면 여러 곳에서 쓰는 목표·수익률 계산을 한곳에 모읍니다. */
export function computePlan(profile: Profile, holdings: Holding[]) {
  const etf = portfolioSummary(holdings)
  const total = etf.value + profile.cash
  const etfRate = portfolioReturn(holdings, profile.reinvest)
  const altRate = portfolioReturn(holdings, !profile.reinvest)
  // ETF 성과를 알 수 없으면 사용자가 정한 기본 수익률 사용
  const rate = etfRate ?? profile.annualReturn
  const months = monthsToTarget(total, profile.monthly, rate, profile.target)
  return {
    etf,
    total,
    rate,
    etfRate,
    altRate,
    progress: profile.target > 0 ? Math.min(total / profile.target, 1) : 0,
    months,
    reachAge: months === null ? null : profile.age + Math.ceil(months / 12),
    dividend: annualDividend(holdings),
  }
}

export type Plan = ReturnType<typeof computePlan>

/** 비중 표시용 색 — 추가 순서로 고정해 정렬이 바뀌어도 같은 종목은 같은 색 */
export const SERIES = ['#3d5afe', '#ff7a45', '#1baf7a', '#f5a400', '#e87ba4', '#008300', '#7b5cff', '#e34948']

export function colorMap(holdings: Holding[]) {
  const m = new Map<string, string>()
  holdings.forEach((h, i) => m.set(h.id, SERIES[i] ?? '#b3b8c7'))
  return m
}
