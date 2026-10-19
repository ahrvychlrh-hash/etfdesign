import type { KrEtfRow } from './api'

/** 검색 결과 한 줄 */
export interface EtfPreset {
  symbol: string
  name: string
  /** 검색 보조 키워드 (별명 등) */
  tags?: string
  market: '국내' | '미국' | '실물' | '코인'
}

/** 금 현물(금통장) — 1g 단위, 국제 금 시세 원화 환산 (server/yahoo.ts의 GOLD_GRAM과 같은 값) */
export const GOLD_GRAM = 'GOLD-G'

const SPECIAL: EtfPreset[] = [
  { symbol: GOLD_GRAM, name: '금 현물 (금통장 · 1g 단위)', tags: '금 골드 gold 금통장 금계좌 실물 현물', market: '실물' },
]

/** ETF가 아닌 실물 자산 */
export function isSpecial(symbol: string) {
  return SPECIAL.some((p) => p.symbol === symbol)
}

/** 가상자산 — Yahoo 형식 'BTC-USD' (달러 시세를 원화로 환산) */
export function isCrypto(symbol: string) {
  return /^[A-Z0-9]+-USD$/.test(symbol)
}

/** 보유량 단위 — 금은 그램, 코인은 개, 나머지는 주 */
export function unitOf(symbol: string) {
  return symbol === GOLD_GRAM ? 'g' : isCrypto(symbol) ? '개' : '주'
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

/** 대표 가상자산 — 목록에 없는 코인은 영문 티커로 검색 (Yahoo) */
const CRYPTO: [string, string, string?][] = [
  ['BTC-USD', '비트코인', 'bitcoin 비트 코인 가상자산 암호화폐 크립토'],
  ['ETH-USD', '이더리움', 'ethereum 이더 코인 가상자산 암호화폐 크립토'],
  ['XRP-USD', '리플', 'ripple xrp 코인 가상자산'],
  ['SOL-USD', '솔라나', 'solana 코인 가상자산'],
  ['DOGE-USD', '도지코인', 'dogecoin 도지 코인 가상자산'],
  ['BNB-USD', '바이낸스코인', 'binance bnb 코인 가상자산'],
  ['ADA-USD', '에이다', 'cardano 카르다노 코인 가상자산'],
  ['TRX-USD', '트론', 'tron 코인 가상자산'],
  ['LINK-USD', '체인링크', 'chainlink 코인 가상자산'],
  ['AVAX-USD', '아발란체', 'avalanche 코인 가상자산'],
  ['DOT-USD', '폴카닷', 'polkadot 코인 가상자산'],
  ['USDT-USD', '테더', 'tether 스테이블코인 코인 가상자산'],
]

const CRYPTO_PRESETS: EtfPreset[] = CRYPTO.map(([symbol, name, tags]) => ({ symbol, name, tags, market: '코인' }))

let krCache: { rows: KrEtfRow[]; presets: EtfPreset[] } | null = null

function krPresets(rows: KrEtfRow[]): EtfPreset[] {
  if (krCache?.rows === rows) return krCache.presets
  const presets = rows.map(([code, name]) => ({ symbol: `${code}.KS`, name, tags: KR_TAGS[code], market: '국내' as const }))
  krCache = { rows, presets }
  return presets
}

/** 국내 상장(.KS/.KQ)이 아니면 해외 ETF */
export function isForeign(symbol: string) {
  return !/\.(KS|KQ)$/.test(symbol) && !isSpecial(symbol)
}

/** 큰 제목: 해외 ETF·코인은 티커, 국내 ETF는 이름 */
export function primaryLabel(h: { symbol: string; name: string }) {
  return isForeign(h.symbol) ? displayTicker(h.symbol) : h.name
}

/** 작은 설명: 해외 ETF·코인은 이름, 국내 ETF는 종목코드 */
export function secondaryLabel(h: { symbol: string; name: string }) {
  if (isSpecial(h.symbol)) return '국제 금 시세 원화 환산'
  return isForeign(h.symbol) ? h.name : displayTicker(h.symbol)
}

/** 화면에 보여줄 짧은 코드 (360750.KS → 360750, BTC-USD → BTC) */
export function displayTicker(symbol: string) {
  if (symbol === GOLD_GRAM) return '금통장'
  // Yahoo는 이름이 겹치는 코인에 번호를 붙임 (SUI20947-USD → SUI)
  if (isCrypto(symbol)) return symbol.replace(/-USD$/, '').replace(/^([A-Z]{2,})\d{4,}$/, '$1')
  return symbol.replace(/\.(KS|KQ)$/, '')
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()·.-]/g, '')

/** 국내 전체 목록(시가총액 순) + 대표 미국 ETF에서 검색 */
export function searchPresets(q: string, krRows: KrEtfRow[], limit = 40): EtfPreset[] {
  const all = [...SPECIAL, ...krPresets(krRows), ...US_PRESETS]
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

/** 코인 현물 검색 — 대표 코인 목록에서 (목록에 없으면 영문 티커로 Yahoo 검색) */
export function searchCrypto(q: string): EtfPreset[] {
  const s = norm(q)
  if (!s) return CRYPTO_PRESETS
  const words = q.trim().toLowerCase().split(/\s+/).map(norm).filter(Boolean)
  return CRYPTO_PRESETS.filter((p) => {
    const hay = norm(`${p.symbol}${p.name}${p.tags ?? ''}`)
    return words.every((w) => hay.includes(w))
  })
}

/** ETF 운용사(브랜드)별 색 — 이름 앞부분(국내)이나 운용사 이름(해외)으로 판별 */
const BRANDS: [RegExp, string][] = [
  [/^kodex/i, '#2563eb'], // 삼성 — 파랑
  [/^tiger/i, '#f97316'], // 미래에셋 — 주황
  [/^ace/i, '#dc2626'], // 한국투자 — 빨강
  [/^rise|^kbstar/i, '#b7791f'], // KB — 황토
  [/^sol/i, '#0ea5e9'], // 신한 — 하늘
  [/^plus|^arirang/i, '#e11d74'], // 한화 — 분홍
  [/^hanaro/i, '#16a34a'], // NH — 초록
  [/^kiwoom|^kosef/i, '#a21caf'], // 키움 — 자주
  [/^time/i, '#7c3aed'], // 타임폴리오 — 보라
  [/^1q/i, '#0d9488'], // 하나 — 청록
  [/^koact/i, '#1e3a8a'], // 삼성액티브 — 남색
  [/^won/i, '#0369a1'], // 우리 — 짙은 하늘
  [/vanguard/i, '#9b1c1c'], // 버건디
  [/ishares/i, '#1f2937'], // 검정
  [/spdr|select sector/i, '#4d7c0f'], // 올리브
  [/schwab/i, '#00a0df'], // 하늘
  [/invesco/i, '#4338ca'], // 인디고
  [/jpmorgan/i, '#78350f'], // 갈색
  [/global x/i, '#0891b2'], // 청록
  [/proshares/i, '#b45309'], // 호박
]

/** 금 현물·기타 운용사 */
const OTHER_BRAND = '#94a3b8'

export function brandColor(h: { symbol: string; name: string }) {
  if (h.symbol === GOLD_GRAM) return '#d4a017'
  const name = h.name.trim()
  return BRANDS.find(([re]) => re.test(name))?.[1] ?? OTHER_BRAND
}
