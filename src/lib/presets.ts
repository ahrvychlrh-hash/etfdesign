import type { KrEtfRow } from './api'

/** 검색 결과 한 줄 */
export interface EtfPreset {
  symbol: string
  name: string
  /** 검색 보조 키워드 (별명 등) */
  tags?: string
  market: '국내' | '미국'
}

/** 국내 ETF 별명 (예: 슈드) — 코드 기준 */
const KR_TAGS: Record<string, string> = {
  '458730': '슈드 schd',
  '446720': '슈드 schd',
  '360750': 'sp500 에스앤피',
  '379800': 'sp500 에스앤피',
  '360200': 'sp500 에스앤피',
  '133690': 'nasdaq',
  '379810': 'nasdaq',
  '252670': '곱버스',
}

const US: [string, string, string?][] = [
  ['VOO', 'Vanguard S&P 500', 'sp500 에스앤피 미국'],
  ['SPY', 'SPDR S&P 500', 'sp500 미국'],
  ['IVV', 'iShares Core S&P 500', 'sp500 미국'],
  ['VTI', 'Vanguard Total Stock Market', '미국전체'],
  ['QQQ', 'Invesco QQQ Trust', '나스닥 큐큐큐'],
  ['QQQM', 'Invesco NASDAQ 100', '나스닥'],
  ['SCHD', 'Schwab US Dividend Equity', '슈드 배당'],
  ['JEPI', 'JPMorgan Equity Premium Income', '제피 배당 커버드콜'],
  ['JEPQ', 'JPMorgan Nasdaq Equity Premium Income', '배당 커버드콜'],
  ['VYM', 'Vanguard High Dividend Yield', '배당'],
  ['DGRO', 'iShares Core Dividend Growth', '배당'],
  ['VT', 'Vanguard Total World Stock', '전세계'],
  ['SOXX', 'iShares Semiconductor', '반도체'],
  ['SMH', 'VanEck Semiconductor', '반도체'],
  ['TLT', 'iShares 20+ Year Treasury Bond', '채권 국채'],
  ['IEF', 'iShares 7-10 Year Treasury Bond', '채권 국채'],
  ['BND', 'Vanguard Total Bond Market', '채권'],
  ['SGOV', 'iShares 0-3 Month Treasury Bond', '채권 파킹'],
  ['GLD', 'SPDR Gold Shares', '금 골드'],
  ['TQQQ', 'ProShares UltraPro QQQ', '레버리지 나스닥'],
]

const US_PRESETS: EtfPreset[] = US.map(([symbol, name, tags]) => ({ symbol, name, tags, market: '미국' }))

let krCache: { rows: KrEtfRow[]; presets: EtfPreset[] } | null = null

function krPresets(rows: KrEtfRow[]): EtfPreset[] {
  if (krCache?.rows === rows) return krCache.presets
  const presets = rows.map(([code, name]) => ({ symbol: `${code}.KS`, name, tags: KR_TAGS[code], market: '국내' as const }))
  krCache = { rows, presets }
  return presets
}

/** 국내 상장(.KS/.KQ)이 아니면 해외 ETF */
export function isForeign(symbol: string) {
  return !/\.(KS|KQ)$/.test(symbol)
}

/** 큰 제목: 해외 ETF는 티커, 국내 ETF는 이름 */
export function primaryLabel(h: { symbol: string; name: string }) {
  return isForeign(h.symbol) ? h.symbol : h.name
}

/** 작은 설명: 해외 ETF는 이름, 국내 ETF는 종목코드 */
export function secondaryLabel(h: { symbol: string; name: string }) {
  return isForeign(h.symbol) ? h.name : displayTicker(h.symbol)
}

/** 화면에 보여줄 짧은 코드 (360750.KS → 360750) */
export function displayTicker(symbol: string) {
  return symbol.replace(/\.(KS|KQ)$/, '')
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()·.-]/g, '')

/** 국내 전체 목록(시가총액 순) + 대표 미국 ETF에서 검색 */
export function searchPresets(q: string, krRows: KrEtfRow[], limit = 40): EtfPreset[] {
  const all = [...krPresets(krRows), ...US_PRESETS]
  const s = norm(q)
  if (!s) return all.slice(0, 10)
  const words = q.trim().toLowerCase().split(/\s+/).map(norm).filter(Boolean)
  const hits = all.filter((p) => {
    const hay = norm(`${p.symbol}${p.name}${p.tags ?? ''}`)
    return words.every((w) => hay.includes(w))
  })
  // 이름이 검색어로 시작하거나 코드가 정확히 맞으면 위로
  const score = (p: EtfPreset) =>
    displayTicker(p.symbol).toLowerCase() === s ? 0 : norm(p.name).includes(s) ? 1 : 2
  return hits.sort((a, b) => score(a) - score(b)).slice(0, limit)
}
