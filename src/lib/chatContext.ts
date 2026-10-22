import type { AppState } from './types'
import type { Plan } from './plan'
import { splitReserve } from './plan'
import { ASSET_CLASSES, assetClassOf } from './expected'
import { dayChange, expectedReturn, holdingDividend, holdingValue, withdrawalPlan } from './finance'
import { judgeCountries, judgeSectors, portfolioExposure } from './exposure'
import { monthRows, realPrincipal, reinvestTotal, yearSummaries } from './history'
import { positions, rebalance } from './rebalance'
import { displayTicker } from './presets'
import { duration, pct, wonShort } from './format'

/**
 * 모아(AI)에게 보내는 포트폴리오 요약 글.
 * withAmounts가 false면 금액(원)은 빼고 비중(%)·수익률만 보냅니다.
 */
export function buildChatContext(state: AppState, plan: Plan, withAmounts: boolean) {
  const { profile, accounts } = state
  if (!profile) return ''
  const money = (n: number) => (withAmounts ? wonShort(n) : '(금액 비공개)')
  const share = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0%')
  const { investHoldings } = splitReserve(state.holdings, accounts)
  const investValue = plan.etf.value
  const lines: string[] = []
  const add = (...l: string[]) => lines.push(...l)

  // 목표
  add('## 목표')
  add(`- 나이 ${profile.age}세, 목표 금액 ${money(profile.target)}, 매달 투자 ${money(profile.monthly)}`)
  add(`- 목표 달성률 ${(plan.progress * 100).toFixed(1)}%`)
  add(
    `- 보유 ETF 기대 수익률(배당 재투자 ${profile.reinvest ? '켬' : '끔'}) 연 ${plan.rate.toFixed(1)}%` +
      (plan.months === null ? ', 지금 속도로는 60년 안에 목표 달성이 어려움' : `, 목표까지 약 ${duration(plan.months)} (${plan.reachAge}세 예상)`),
  )
  const w = withdrawalPlan(profile.target, plan.rate)
  add(`- 목표를 모은 뒤 4% 룰로 꺼내 쓰면 월 ${money(w.monthly)}`)

  // 총자산
  add('', '## 총자산 구성')
  add(`- 총자산 ${money(plan.total)}`)
  add(
    `- 투자 자산(ETF·금) ${share(investValue, plan.total)}, 비상금 ${share(plan.reserve, plan.total)}, 부동산 ${share(plan.realEstate, plan.total)}, 코인 현물 ${share(plan.crypto, plan.total)}`,
  )
  add('- 비상금·부동산·코인 현물은 총자산에만 더하고 수익률·리밸런싱 계산에서는 뺌')

  // 투자 자산 수익
  const principal = realPrincipal(investHoldings, state.reinvests)
  const gain = investValue - principal
  const today = dayChange(investHoldings)
  add('', '## 투자 자산 수익')
  add(`- 평가금 ${money(investValue)}, 실제 원금(투자금 − 재투자) ${money(principal)}`)
  add(`- 총 수익 ${withAmounts ? wonShort(gain) + ' ' : ''}(${principal > 0 ? pct((gain / principal) * 100) : '—'}), 수익에는 재투자 ${money(reinvestTotal(state.reinvests))} 포함`)
  if (today) add(`- 오늘(전일 종가 대비) ${pct(today.pct, 2)}`)
  add(`- 연 예상 배당(세전) ${money(plan.dividend)}, 배당수익률 ${share(plan.dividend, investValue)}`)

  // 계좌
  add('', '## 계좌별')
  for (const a of accounts) {
    const list = state.holdings.filter((h) => h.accountId === a.id)
    const value = list.reduce((s, h) => s + holdingValue(h), 0) + (a.cash ?? 0)
    const invested = list.reduce((s, h) => s + h.invested, 0)
    const r = invested > 0 ? pct(((value - (a.cash ?? 0) - invested) / invested) * 100) : '—'
    add(`- ${a.name} (${a.kind}): ETF ${list.length}개, 투자 자산 중 ${a.kind === '비상금' ? '제외(비상금)' : share(value, investValue)}, 수익률 ${r}`)
  }

  // ETF
  add('', '## 보유 ETF (투자 자산 비중 큰 순)')
  const accName = new Map(accounts.map((a) => [a.id, a.name]))
  const sorted = [...investHoldings].sort((a, b) => holdingValue(b) - holdingValue(a))
  for (const h of sorted) {
    const v = holdingValue(h)
    const r = h.invested > 0 ? pct(((v - h.invested) / h.invested) * 100) : '—'
    const d = dayChange([h])
    const cls = ASSET_CLASSES[assetClassOf(h.name, h.symbol, h.stats?.tab)].label
    add(
      `- ${h.name} (${displayTicker(h.symbol)}) · ${accName.get(h.accountId) ?? ''} · 비중 ${share(v, investValue)}` +
        `${withAmounts ? ` · 평가 ${wonShort(v)}` : ''} · 수익률 ${r}${d ? ` · 오늘 ${pct(d.pct, 2)}` : ''}` +
        ` · 분류 ${cls} · 기대 연 ${expectedReturn(h, profile.reinvest).toFixed(1)}% · 배당수익률 ${share(holdingDividend(h), v)}`,
    )
  }

  // 리밸런싱
  const pos = positions(investHoldings)
  const hasTargets = pos.some((p) => (state.targets[p.symbol] ?? 0) > 0)
  add('', '## 리밸런싱 (사용자가 정한 목표 비중)')
  if (!hasTargets) {
    add('- 목표 비중을 아직 정하지 않음')
  } else {
    for (const r of rebalance(pos, state.targets, 0, false)) {
      const move =
        r.action === 'hold'
          ? '유지'
          : `${r.action === 'buy' ? '매수' : '매도'}${withAmounts ? ` ${wonShort(Math.abs(r.amount))}` : ''}${r.within ? ' (차이 작아 안 해도 됨)' : ''}`
      add(`- ${r.name}: 현재 ${r.current.toFixed(1)}% → 목표 ${r.target.toFixed(1)}% · ${move}`)
    }
  }

  // 비중 분석
  const ex = portfolioExposure(investHoldings)
  const fmt = (items: { key: string; pct: number; level?: string }[]) =>
    items
      .filter((i) => i.pct >= 1)
      .map((i) => `${i.key} ${i.pct.toFixed(1)}%${i.level && i.level !== 'ok' ? `(${i.level === 'high' ? '높음' : '낮음'})` : ''}`)
      .join(', ')
  add('', '## 비중 분석 (기초지수 대표 구성으로 추정)')
  add(`- 자산군: ${fmt(ex.asset) || '없음'}`)
  add(`- 나라: ${fmt(judgeCountries(ex.country)) || '없음'}`)
  add(`- 섹터(주식 부분): ${fmt(judgeSectors(ex.sector)) || '없음'}`)

  // 기록
  const rows = monthRows(state.snapshots)
  if (rows.length) {
    add('', '## 월별 기록 (최근 12개월, 그달 말 기준)')
    for (const r of rows.slice(-12)) {
      add(
        `- ${r.month}${r.ongoing ? '(진행 중)' : ''}: 누적 수익률 ${r.gainPct == null ? '—' : pct(r.gainPct)}` +
          `${r.ret == null ? '' : `, 그달 수익률 ${pct(r.ret)}`}${withAmounts ? `, 월말 자산 ${wonShort(r.value)}` : ''}`,
      )
    }
    add('', '## 연도별')
    for (const y of yearSummaries(rows, state.reinvests)) {
      add(`- ${y.year}년${y.ongoing ? '(진행 중)' : ''}: 연 수익률 ${pct(y.yearReturn)}${withAmounts ? `, 수익금 ${wonShort(y.profit)}` : ''}`)
    }
  }

  // 코인 현물
  if (state.cryptos.length) {
    add('', '## 코인 현물 (총자산에만 포함)')
    add(`- ${state.cryptos.map((c) => `${c.name} ${share(c.quantity * c.price, plan.crypto)}`).join(', ')}`)
  }

  return lines.join('\n')
}
