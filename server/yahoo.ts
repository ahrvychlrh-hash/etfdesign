/**
 * ETF 시세·과거 수익률·배당 조회.
 * - 국내 ETF 전체 목록·현재가: 네이버 금융 (상장된 모든 ETF)
 * - 과거 성과(최대 30년)·배당 내역·해외 ETF 시세: Yahoo Finance
 * 브라우저에서는 CORS 때문에 직접 부를 수 없어서, 개발 서버(vite)와
 * 배포 서버(Vercel 함수)가 이 모듈을 공통으로 사용합니다.
 */

const UA = { 'User-Agent': 'Mozilla/5.0 (ETF Planner)' }
const DAY = 86400
const MAX_YEARS = 30

export interface QuoteResult {
  symbol: string
  name: string
  currency: string
  /** 원래 통화 기준 현재가 */
  nativePrice: number
  /** 원화 환산 현재가 */
  price: number
  fx: number
  /** 최근 최대 30년 가격 연평균 수익률 (소수) — 데이터 없으면 null */
  priceCagr: number | null
  /** 최근 최대 30년 배당 재투자 포함 연평균 수익률 */
  totalCagr: number | null
  /** 수익률 계산에 쓴 기간(년) */
  years: number
  /** 최근 12개월 1주당 배당금 (원래 통화) */
  div12m: number
  /** 최근 12개월 배당 지급 월 (1~12) */
  payMonths: number[]
  /** 네이버 ETF 분류 코드 (국내만) */
  tab?: number
}

/** 국내 ETF 한 줄: [종목코드, 이름, 분류코드] */
export type KrEtfRow = [string, string, number]

export interface SearchItem {
  symbol: string
  name: string
  exchange: string
}

const cache = new Map<string, { at: number; data: unknown }>()

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T
  const data = await load()
  cache.set(key, { at: Date.now(), data })
  return data
}

async function getJson(url: string) {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/* ---------------- 네이버: 국내 ETF 전체 ---------------- */

interface NaverEtf {
  itemcode: string
  itemname: string
  etfTabCode: number
  nowVal: number
}

function naverList(): Promise<NaverEtf[]> {
  return cached('naver:etfs', 60_000, async () => {
    // 네이버 응답은 EUC-KR 인코딩이라 직접 디코딩
    const res = await fetch('https://finance.naver.com/api/sise/etfItemList.nhn', { headers: UA })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = JSON.parse(new TextDecoder('euc-kr').decode(await res.arrayBuffer()))
    return j.result.etfItemList as NaverEtf[]
  })
}

export async function krEtfList(): Promise<KrEtfRow[]> {
  const list = await naverList()
  return list.map((e) => [e.itemcode, e.itemname, e.etfTabCode])
}

/* ---------------- Yahoo: 과거 성과·배당 ---------------- */

async function usdKrw(): Promise<number> {
  return cached('fx:USDKRW', 10 * 60_000, async () => {
    const j = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range=1d&interval=1d')
    return j.chart.result[0].meta.regularMarketPrice as number
  })
}

function cagr(first: number, last: number, years: number) {
  if (!(first > 0) || !(last > 0) || years < 0.9) return null
  return Math.pow(last / first, 1 / years) - 1
}

interface History {
  name: string
  currency: string
  price: number
  priceCagr: number | null
  totalCagr: number | null
  years: number
  div12m: number
  payMonths: number[]
}

async function yahooHistory(sym: string): Promise<History> {
  const j = await getJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=max&interval=1mo&events=div`,
  )
  const r = j.chart?.result?.[0]
  if (!r) throw new Error('not found')
  const meta = r.meta
  const ts: number[] = r.timestamp ?? []
  const close: (number | null)[] = r.indicators?.quote?.[0]?.close ?? []
  const adj: (number | null)[] = r.indicators?.adjclose?.[0]?.adjclose ?? []

  const now = Date.now() / 1000
  const since = now - MAX_YEARS * 365.25 * DAY
  const valid = ts
    .map((t, i) => ({ t, c: close[i], a: adj[i] ?? close[i] }))
    .filter((p) => p.t >= since && p.c != null && p.c > 0)
  const first = valid[0]
  const last = valid[valid.length - 1]
  const years = first && last ? (last.t - first.t) / (365.25 * DAY) : 0

  const divs = Object.values((r.events?.dividends ?? {}) as Record<string, { amount: number; date: number }>)
  const recent = divs.filter((d) => now - d.date <= 365 * DAY)
  const div12m = recent.reduce((s, d) => s + d.amount, 0)
  const payMonths = [...new Set(recent.map((d) => new Date((d.date + 9 * 3600) * 1000).getUTCMonth() + 1))].sort(
    (a, b) => a - b,
  )

  const price: number = meta.regularMarketPrice
  const priceCagr = first ? cagr(first.c!, last.c!, years) : null
  let totalCagr = first ? cagr(first.a!, last.a!, years) : null
  // 수정주가에 배당이 빠진 경우 가격 수익률 + 배당수익률로 보정
  const divYield = price > 0 ? div12m / price : 0
  if (priceCagr != null && (totalCagr == null || (divYield > 0.002 && totalCagr <= priceCagr))) {
    totalCagr = priceCagr + divYield
  }

  return {
    name: meta.shortName ?? meta.longName ?? sym,
    currency: meta.currency ?? 'KRW',
    price,
    priceCagr,
    totalCagr,
    years: Math.round(years * 10) / 10,
    div12m,
    payMonths,
  }
}

/** 금 현물(금통장) 1g 원화 시세를 나타내는 특수 심볼 */
export const GOLD_GRAM = 'GOLD-G'
const GRAMS_PER_TROY_OUNCE = 31.1034768

export function getQuote(symbol: string): Promise<QuoteResult> {
  const sym = symbol.trim().toUpperCase()
  return cached(`q:${sym}`, 5 * 60_000, async () => {
    if (sym === GOLD_GRAM) {
      // 국제 금 선물(달러/온스) × 환율 ÷ 31.1g = 원화 1g 가격
      const [hist, fx] = await Promise.all([yahooHistory('GC=F'), usdKrw()])
      const perGram = (hist.price * fx) / GRAMS_PER_TROY_OUNCE
      return {
        symbol: GOLD_GRAM,
        name: '금 현물 (금통장)',
        currency: 'KRW',
        nativePrice: perGram,
        price: perGram,
        fx: 1,
        priceCagr: hist.priceCagr,
        totalCagr: hist.totalCagr,
        years: hist.years,
        div12m: 0,
        payMonths: [],
      }
    }

    const krCode = sym.match(/^([0-9A-Z]{6})\.(KS|KQ)$/)?.[1]

    if (krCode) {
      // 국내: 현재가·이름은 네이버, 과거 성과는 Yahoo(신규 상장 등으로 없으면 생략)
      const [list, hist] = await Promise.all([naverList(), yahooHistory(sym).catch(() => null)])
      const item = list.find((e) => e.itemcode === krCode)
      const price = item?.nowVal ?? hist?.price
      if (!price) throw new Error('not found')
      return {
        symbol: sym,
        name: item?.itemname ?? hist?.name ?? sym,
        currency: 'KRW',
        nativePrice: price,
        price,
        fx: 1,
        priceCagr: hist?.priceCagr ?? null,
        totalCagr: hist?.totalCagr ?? null,
        years: hist?.years ?? 0,
        div12m: hist?.div12m ?? 0,
        payMonths: hist?.payMonths ?? [],
        tab: item?.etfTabCode,
      }
    }

    const hist = await yahooHistory(sym)
    const fx = hist.currency === 'USD' ? await usdKrw() : 1
    return {
      symbol: sym,
      name: hist.name,
      currency: hist.currency,
      nativePrice: hist.price,
      price: hist.price * fx,
      fx,
      priceCagr: hist.priceCagr,
      totalCagr: hist.totalCagr,
      years: hist.years,
      div12m: hist.div12m,
      payMonths: hist.payMonths,
    }
  })
}

/* ---------------- 기초지수 30년 평균 ---------------- */

/**
 * 자산군별 기초지수. 가격지수(^)는 배당이 빠져 있어 평균 배당수익률(%)을 더합니다.
 * ETF(DVY·TLT 등)는 수정주가(배당 재투자 포함)로 계산합니다.
 */
const BENCHMARKS: Record<string, { symbol: string; label: string; addDiv: number }> = {
  usLarge: { symbol: '^GSPC', label: 'S&P500', addDiv: 1.8 },
  usTech: { symbol: '^NDX', label: '나스닥100', addDiv: 0.8 },
  semis: { symbol: '^SOX', label: '필라델피아 반도체', addDiv: 0.8 },
  usDividend: { symbol: 'DVY', label: '미국 배당주', addDiv: 0 },
  kospi: { symbol: '^KS11', label: '코스피', addDiv: 1.7 },
  krDividend: { symbol: '^KS11', label: '코스피', addDiv: 1.7 },
  krSector: { symbol: '^KS11', label: '코스피', addDiv: 1.7 },
  kosdaq: { symbol: '^KQ11', label: '코스닥', addDiv: 0.5 },
  world: { symbol: 'ACWI', label: '전세계 주식(ACWI)', addDiv: 0 },
  equity: { symbol: 'ACWI', label: '전세계 주식(ACWI)', addDiv: 0 },
  intl: { symbol: 'EEM', label: '신흥국 주식(EEM)', addDiv: 0 },
  bondLong: { symbol: 'TLT', label: '미국 장기채(TLT)', addDiv: 0 },
  bond: { symbol: 'IEF', label: '미국 중기채(IEF)', addDiv: 0 },
  gold: { symbol: 'GC=F', label: '금 선물', addDiv: 0 },
  reits: { symbol: 'VNQ', label: '미국 리츠(VNQ)', addDiv: 0 },
}

export interface BenchmarkResult {
  label: string
  symbol: string
  /** 연평균 수익률 (%, 배당 포함) */
  rate: number
  years: number
}

export function getBenchmarks(): Promise<Record<string, BenchmarkResult>> {
  return cached('benchmarks', 24 * 3600_000, async () => {
    const bySymbol = new Map<string, { cagr: number; years: number } | null>()
    const symbols = [...new Set(Object.values(BENCHMARKS).map((b) => b.symbol))]
    await Promise.all(
      symbols.map(async (s) => {
        const h = await yahooHistory(s).catch(() => null)
        const r = h?.totalCagr ?? h?.priceCagr
        bySymbol.set(s, h && r != null ? { cagr: r * 100, years: h.years } : null)
      }),
    )
    const out: Record<string, BenchmarkResult> = {}
    for (const [cls, b] of Object.entries(BENCHMARKS)) {
      const h = bySymbol.get(b.symbol)
      if (!h) continue
      out[cls] = { label: b.label, symbol: b.symbol, rate: Math.round((h.cagr + b.addDiv) * 100) / 100, years: h.years }
    }
    return out
  })
}

export function searchEtf(query: string): Promise<SearchItem[]> {
  const q = query.trim()
  if (!q) return Promise.resolve([])
  return cached(`s:${q.toLowerCase()}`, 60 * 60_000, async () => {
    const j = await getJson(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0`,
    )
    return ((j.quotes ?? []) as Record<string, string>[])
      .filter(
        (x) =>
          (x.quoteType === 'ETF' && !/\.(KS|KQ)$/.test(x.symbol)) ||
          // 가상자산은 달러 시세(BTC-USD)만 — 원화 환산은 getQuote에서
          (x.quoteType === 'CRYPTOCURRENCY' && /^[A-Z0-9]+-USD$/.test(x.symbol)),
      )
      .map((x) => ({ symbol: x.symbol, name: x.longname ?? x.shortname ?? x.symbol, exchange: x.exchDisp ?? '' }))
  })
}

/** URL 경로·쿼리로 API 요청을 처리합니다. (dev 서버·Vercel 공통) */
export async function handleApi(url: URL): Promise<{ status: number; body: unknown }> {
  try {
    if (url.pathname.endsWith('/quote')) {
      const symbol = url.searchParams.get('symbol')
      if (!symbol) return { status: 400, body: { error: 'symbol 필요' } }
      return { status: 200, body: await getQuote(symbol) }
    }
    if (url.pathname.endsWith('/search')) {
      return { status: 200, body: await searchEtf(url.searchParams.get('q') ?? '') }
    }
    if (url.pathname.endsWith('/benchmarks')) {
      return { status: 200, body: await getBenchmarks() }
    }
    if (url.pathname.endsWith('/etfs')) {
      return { status: 200, body: await krEtfList() }
    }
    return { status: 404, body: { error: 'not found' } }
  } catch (e) {
    return { status: 502, body: { error: e instanceof Error ? e.message : 'error' } }
  }
}
