/**
 * 시장 지수 — 코스피·코스닥·S&P500·나스닥·VIX 등 (Yahoo Finance).
 * - now: 지금 값·전일 대비·최근 한 달 흐름
 * - history: 한 지수의 기간별 흐름 (1개월~10년)
 * - monthly: '내 수익률과 시장 비교'용 월말 종가 + 원/달러 환율
 */

const UA = { 'User-Agent': 'Mozilla/5.0 (ETF Planner)' }

export interface IndexInfo {
  id: string
  symbol: string
  name: string
  /** 짧은 설명 (예: VIX는 높을수록 불안) */
  note?: string
  /** 값 표시 방식: point(지수)·won(원)·usd(달러)·pct(금리 %) */
  unit: 'point' | 'won' | 'usd' | 'pct'
  /** 달러 시세를 원화로 바꿔서 보여줌 (그때그때 원/달러 환율 적용) — divide로 나누기 (금 1온스 → 1g) */
  toKrw?: { divide?: number }
}

/** 금 1트로이온스 = 31.1035g */
const GRAMS_PER_OZ = 31.1034768

export const INDICES: IndexInfo[] = [
  { id: 'kospi', symbol: '^KS11', name: '코스피', unit: 'point' },
  { id: 'kosdaq', symbol: '^KQ11', name: '코스닥', unit: 'point' },
  { id: 'sp500', symbol: '^GSPC', name: 'S&P 500', unit: 'point' },
  { id: 'nasdaq', symbol: '^IXIC', name: '나스닥', unit: 'point' },
  { id: 'dow', symbol: '^DJI', name: '다우존스', unit: 'point' },
  { id: 'vix', symbol: '^VIX', name: 'VIX 공포지수', note: '높을수록 시장이 불안해요 (20 이상 주의, 30 이상 공포)', unit: 'point' },
  { id: 'sox', symbol: '^SOX', name: '반도체 (SOX)', note: '필라델피아 반도체 지수', unit: 'point' },
  { id: 'nikkei', symbol: '^N225', name: '닛케이 225', unit: 'point' },
  { id: 'usdkrw', symbol: 'KRW=X', name: '원/달러 환율', note: '오르면 달러가 비싸져요 (해외 ETF 원화 가치 ↑)', unit: 'won' },
  { id: 'tnx', symbol: '^TNX', name: '미국 10년 금리', note: '미국 10년 국채 금리 — 오르면 채권 가격은 내려가요', unit: 'pct' },
  { id: 'gold', symbol: 'GC=F', name: '금 (1g)', note: '국제 금 시세를 원화 1g으로 바꾼 값이에요', unit: 'won', toKrw: { divide: GRAMS_PER_OZ } },
  { id: 'btc', symbol: 'BTC-USD', name: '비트코인', note: '24시간 거래돼요 · 국제 시세를 원화로 바꾼 값이에요', unit: 'won', toKrw: {} },
]

/** 내 수익률과 비교하는 지수 */
export const COMPARE_IDS = ['kospi', 'sp500', 'nasdaq', 'gold'] as const

const cache = new Map<string, { at: number; data: unknown }>()
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T
  const data = await load()
  cache.set(key, { at: Date.now(), data })
  return data
}

interface ChartResult {
  meta: { regularMarketPrice?: number; regularMarketTime?: number; currency?: string; gmtoffset?: number }
  timestamp?: number[]
  indicators?: { quote?: { close?: (number | null)[] }[] }
}

async function chart(symbol: string, query: string): Promise<ChartResult> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`, { headers: UA })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j.chart?.result?.[0]
  if (!r) throw new Error('no data')
  return r
}

/** [시각(초), 종가] — 값이 빈 날은 뺌 */
function points(r: ChartResult): [number, number][] {
  const ts = r.timestamp ?? []
  const close = r.indicators?.quote?.[0]?.close ?? []
  const out: [number, number][] = []
  ts.forEach((t, i) => {
    const c = close[i]
    if (c != null && c > 0) out.push([t, c])
  })
  return out
}

/** 시각 순으로 정렬된 환율 중 그 시각 이전의 가장 가까운 값 */
function fxAt(fx: [number, number][], t: number) {
  let v = fx[0]?.[1]
  for (const [ft, fv] of fx) {
    if (ft > t + 12 * 3600) break
    v = fv
  }
  return v
}

/** 차트 받기 — toKrw면 같은 기간 원/달러 환율을 곱해 원화로 */
async function load(info: IndexInfo, query: string) {
  const [r, fxr] = await Promise.all([chart(info.symbol, query), info.toKrw ? chart('KRW=X', query) : null])
  let pts = points(r)
  let price = r.meta.regularMarketPrice ?? pts[pts.length - 1]?.[1]
  if (fxr && info.toKrw) {
    const fx = points(fxr)
    const div = info.toKrw.divide ?? 1
    if (!fx.length) throw new Error('no fx')
    pts = pts.map(([t, c]) => [t, (c * fxAt(fx, t)) / div])
    price = (price * (fxr.meta.regularMarketPrice ?? fx[fx.length - 1][1])) / div
  }
  return { pts, price, time: r.meta.regularMarketTime ?? pts[pts.length - 1]?.[0] ?? 0, meta: r.meta }
}

export interface IndexNow extends IndexInfo {
  price: number
  /** 전일 종가 대비 */
  change: number
  changePct: number
  /** 최근 한 달 종가 (작은 그래프용) */
  spark: number[]
  /** 마지막 시세 시각(초) */
  time: number
}

/** 지수 전체의 지금 값 */
export function getMarketNow(): Promise<IndexNow[]> {
  return cached('market:now', 2 * 60_000, async () => {
    const list = await Promise.all(
      INDICES.map(async (info) => {
        try {
          const { pts, price, time } = await load(info, 'range=1mo&interval=1d')
          if (!pts.length) return null
          // 마지막 일봉이 오늘 것이면 그 앞이 전일 종가
          const lastIsToday = time - pts[pts.length - 1][0] < 20 * 3600
          const prev = lastIsToday ? pts[pts.length - 2]?.[1] : pts[pts.length - 1][1]
          const change = prev ? price - prev : 0
          return {
            ...info,
            price,
            change,
            changePct: prev ? (change / prev) * 100 : 0,
            spark: pts.map((p) => p[1]),
            time,
          } satisfies IndexNow
        } catch {
          return null
        }
      }),
    )
    return list.filter((x): x is IndexNow => x !== null)
  })
}

export const RANGES = { '1mo': '1d', '3mo': '1d', '1y': '1d', '5y': '1wk', '10y': '1mo' } as const
export type Range = keyof typeof RANGES

/** 한 지수의 기간별 흐름 */
export function getIndexHistory(id: string, range: Range): Promise<[number, number][]> {
  const info = INDICES.find((i) => i.id === id)
  if (!info) throw new Error('unknown index')
  return cached(`market:hist:${id}:${range}`, 30 * 60_000, async () => (await load(info, `range=${range}&interval=${RANGES[range]}`)).pts)
}

/** 'YYYY-MM' → 그달 마지막 종가 (월봉 기준, 이번 달은 지금까지의 마지막 값) */
async function monthlyCloses(symbol: string): Promise<Record<string, number>> {
  const r = await chart(symbol, 'range=10y&interval=1mo')
  const off = r.meta.gmtoffset ?? 0
  const out: Record<string, number> = {}
  for (const [t, c] of points(r)) {
    const d = new Date((t + off) * 1000)
    out[`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`] = c
  }
  // 이번 달은 월봉 대신 지금 값
  const now = r.meta.regularMarketPrice
  const t = r.meta.regularMarketTime
  if (now && t) {
    const d = new Date((t + off) * 1000)
    out[`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`] = now
  }
  return out
}

/** 비교용 지수들과 원/달러 환율의 월말 값 */
export function getMarketMonthly(): Promise<Record<string, Record<string, number>>> {
  return cached('market:monthly', 6 * 3600_000, async () => {
    const ids = [...COMPARE_IDS, 'usdkrw']
    const out: Record<string, Record<string, number>> = {}
    await Promise.all(
      ids.map(async (id) => {
        const info = INDICES.find((i) => i.id === id)!
        out[id] = await monthlyCloses(info.symbol).catch(() => ({}))
      }),
    )
    return out
  })
}

/** /api/market?view=now | history&id=kospi&range=1y | monthly */
export async function handleMarket(url: URL): Promise<{ status: number; body: unknown; maxAge: number }> {
  const view = url.searchParams.get('view') ?? 'now'
  if (view === 'now') return { status: 200, body: await getMarketNow(), maxAge: 120 }
  if (view === 'history') {
    const id = url.searchParams.get('id') ?? ''
    const range = (url.searchParams.get('range') ?? '1y') as Range
    if (!INDICES.some((i) => i.id === id) || !(range in RANGES)) return { status: 400, body: { error: 'id·range 확인' }, maxAge: 0 }
    return { status: 200, body: await getIndexHistory(id, range), maxAge: 1800 }
  }
  if (view === 'monthly') return { status: 200, body: await getMarketMonthly(), maxAge: 21600 }
  return { status: 400, body: { error: 'view 확인' }, maxAge: 0 }
}
