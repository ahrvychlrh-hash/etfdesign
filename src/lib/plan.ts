import type { Holding, Profile, RealEstate } from './types'
import { annualDividend, monthsToTarget, portfolioReturn, portfolioSummary } from './finance'

/** 보유 ETF가 없을 때 예측에 쓰는 기본 연 수익률(%) */
export const DEFAULT_RATE = 7

/** 화면 여러 곳에서 쓰는 목표·수익률 계산을 한곳에 모읍니다. */
export function computePlan(profile: Profile, holdings: Holding[], realEstates: RealEstate[] = []) {
  const etf = portfolioSummary(holdings)
  // 부동산은 총자산에는 넣지만 수익률·성장 예측에서는 빼고 고정값으로 둠
  const realEstate = realEstates.reduce((s, r) => s + r.value, 0)
  // 총자산 = 투자 자산(ETF·금) 평가금 + 부동산
  const total = etf.value + realEstate
  const etfRate = portfolioReturn(holdings, profile.reinvest)
  const altRate = portfolioReturn(holdings, !profile.reinvest)
  // 목표 수익률 = 보유 ETF 기대 수익률의 비중 가중평균 (ETF가 없으면 기본 가정)
  const rate = etfRate ?? DEFAULT_RATE
  // 투자 자산만 불어난다고 보고, 목표에서 부동산만큼은 이미 채운 것으로 계산
  const months = monthsToTarget(etf.value, profile.monthly, rate, profile.target - realEstate)
  return {
    etf,
    realEstate,
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
