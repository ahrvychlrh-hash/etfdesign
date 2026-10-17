import type { Holding } from './types'
import type { KrEtfRow, ScannedHolding } from './api'
import { displayTicker } from './presets'

/** 캡처에서 읽은 한 줄을 내 보유 ETF와 맞춘 결과 */
export interface ScanMatch {
  row: ScannedHolding
  /** 이 계좌에 이미 있는 ETF — 있으면 업데이트 */
  target?: Holding
  /** 새로 추가할 때 쓸 심볼 — 못 찾으면 없음 */
  symbol?: string
  name: string
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()·.…\-_&]/g, '')

/**
 * 2: 이름이 같음, 1: 앱이 이름을 잘라서 보여준 경우(전체 이름이 캡처 이름을 포함), 0: 다름.
 * 캡처 이름이 더 긴 경우(예: "KODEX 200TR" vs "KODEX 200")는 다른 상품이라 0.
 */
function nameScore(fullName: string, scanned: string) {
  const full = norm(fullName)
  const s = norm(scanned)
  if (!full || !s) return 0
  if (full === s) return 2
  return s.length >= 5 && full.includes(s) ? 1 : 0
}

/** 정확히 같은 이름 하나, 없으면 잘린 이름으로 맞는 게 딱 하나일 때만 — 애매하면 고르지 않음 */
function pickByName<T>(items: T[], nameOf: (t: T) => string, scanned: string): T | undefined {
  const exact = items.filter((t) => nameScore(nameOf(t), scanned) === 2)
  if (exact.length) return exact[0]
  const partial = items.filter((t) => nameScore(nameOf(t), scanned) === 1)
  return partial.length === 1 ? partial[0] : undefined
}

export function matchScanned(rows: ScannedHolding[], accountHoldings: Holding[], kr: KrEtfRow[]): ScanMatch[] {
  const used = new Set<string>()
  return rows.map((row) => {
    const code = row.code?.trim().toUpperCase() ?? ''
    const krCode = /^\d[0-9A-Z]{5}$/.test(code) ? code : null
    const ticker = /^[A-Z]{1,5}$/.test(code) ? code : /^[A-Z]{1,5}$/.test(row.name.trim()) ? row.name.trim() : null

    const free = accountHoldings.filter((h) => !used.has(h.id))
    const target =
      free.find((h) => (krCode && displayTicker(h.symbol) === krCode) || (ticker && h.symbol === ticker)) ??
      pickByName(free, (h) => h.name, row.name)
    if (target) {
      used.add(target.id)
      return { row, target, symbol: target.symbol, name: target.name }
    }

    if (krCode) {
      const hit = kr.find(([c]) => c === krCode)
      return { row, symbol: `${krCode}.KS`, name: hit?.[1] ?? row.name }
    }
    if (ticker) return { row, symbol: ticker, name: row.name }
    // 이름만 보이면 국내 ETF 목록에서 찾기
    const hit = pickByName(kr, ([, n]) => n, row.name)
    if (hit) return { row, symbol: `${hit[0]}.KS`, name: hit[1] }
    return { row, name: row.name }
  })
}

/** 원화 기준 수량·투자금·평가금 — 화면에 없던 값은 null */
export function scannedNumbers(row: ScannedHolding, fx: number | null) {
  const rate = row.currency === 'USD' ? fx : 1
  const qty = row.quantity && row.quantity > 0 ? row.quantity : null
  const cost = row.invested ?? (row.avgPrice != null && qty ? row.avgPrice * qty : null)
  const value = row.value ?? (row.currentPrice != null && qty ? row.currentPrice * qty : null)
  return {
    qty,
    invested: cost != null && rate ? Math.round(cost * rate) : null,
    value: value != null && rate ? Math.round(value * rate) : null,
  }
}
