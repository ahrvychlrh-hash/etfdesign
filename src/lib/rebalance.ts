import type { Holding } from './types'
import { holdingValue } from './finance'
import { isCrypto } from './presets'

/** 같은 ETF는 계좌가 달라도 하나로 합쳐서 비중을 봅니다. */
export interface Position {
  symbol: string
  name: string
  value: number
  price: number
  quantity: number
}

export function positions(holdings: Holding[]): Position[] {
  const map = new Map<string, Position>()
  for (const h of holdings) {
    const p = map.get(h.symbol) ?? { symbol: h.symbol, name: h.name, value: 0, price: h.currentPrice, quantity: 0 }
    p.value += holdingValue(h)
    p.quantity += h.quantity
    map.set(h.symbol, p)
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}

/** 목표 비중과 이 차이(%p) 안이면 '유지' */
export const TOLERANCE = 2

export interface RebalanceRow extends Position {
  current: number
  target: number
  /** 목표 - 현재 (%p) */
  gap: number
  /** + 매수 / - 매도 금액(원) */
  amount: number
  /** 대략적인 주식 수 */
  shares: number
  action: 'buy' | 'sell' | 'hold'
  /** 목표와 ±TOLERANCE%p 이내라 꼭 조정하지 않아도 되는지 */
  within: boolean
}

/**
 * @param extra 이번에 추가로 넣을 돈 (원)
 * @param buyOnly true면 팔지 않고 추가 투자금으로만 부족한 종목을 채움
 */
export function rebalance(list: Position[], targets: Record<string, number>, extra: number, buyOnly: boolean): RebalanceRow[] {
  const total = list.reduce((s, p) => s + p.value, 0)
  const after = total + Math.max(extra, 0)
  const sumTarget = list.reduce((s, p) => s + (targets[p.symbol] ?? 0), 0)
  const weight = (p: Position) => (sumTarget > 0 ? (targets[p.symbol] ?? 0) / sumTarget : 0)

  let amounts: number[]
  if (!buyOnly) {
    amounts = list.map((p) => weight(p) * after - p.value)
  } else {
    // 목표보다 부족한 만큼을 추가 투자금으로 채우고, 남으면 목표 비중대로 나눔
    const needs = list.map((p) => Math.max(weight(p) * after - p.value, 0))
    const needSum = needs.reduce((a, b) => a + b, 0)
    const budget = Math.max(extra, 0)
    if (needSum >= budget) {
      amounts = needs.map((n) => (needSum > 0 ? (n / needSum) * budget : 0))
    } else {
      const rest = budget - needSum
      amounts = needs.map((n, i) => n + rest * weight(list[i]))
    }
  }

  return list.map((p, i) => {
    const current = total > 0 ? (p.value / total) * 100 : 0
    const target = sumTarget > 0 ? weight(p) * 100 : 0
    const gap = target - current
    // 금액은 천원 단위까지만
    const amount = Math.round(amounts[i] / 1000) * 1000
    // 코인은 소수 단위로 살 수 있어서 소수점 4자리까지
    const step = isCrypto(p.symbol) ? 1e4 : 1
    const shares = p.price > 0 ? Math.round((amount / p.price) * step) / step : 0
    const within = Math.abs(gap) <= TOLERANCE && !(extra > 0 && Math.abs(amount) >= p.price)
    const action: RebalanceRow['action'] = amount === 0 ? 'hold' : amount > 0 ? 'buy' : 'sell'
    return { ...p, current, target, gap, amount, shares, action, within }
  })
}
