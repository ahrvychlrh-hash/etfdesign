import type { EtfStats } from './types'

export interface Quote {
  symbol: string
  name: string
  price: number
  stats: EtfStats
}

export interface SearchItem {
  symbol: string
  name: string
  exchange: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  const q = await get<{
    symbol: string
    name: string
    currency: string
    nativePrice: number
    price: number
    fx: number
    priceCagr: number | null
    totalCagr: number | null
    years: number
    div12m: number
    payMonths: number[]
    tab?: number
    prevClose: number | null
  }>(`/api/quote?symbol=${encodeURIComponent(symbol)}`)
  return {
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    stats: {
      currency: q.currency,
      nativePrice: q.nativePrice,
      fx: q.fx,
      priceCagr: q.priceCagr,
      totalCagr: q.totalCagr,
      years: q.years,
      divPerShare: q.div12m * q.fx,
      payMonths: q.payMonths,
      tab: q.tab,
      prevClose: q.prevClose ?? undefined,
      updatedAt: new Date().toISOString(),
    },
  }
}

/** 'YYYY-MM' 월말 종가(원화) — 못 구한 종목은 null */
export function fetchMonthEnd(month: string, symbols: string[]) {
  return get<Record<string, number | null>>(
    `/api/monthend?month=${month}&symbols=${encodeURIComponent([...new Set(symbols)].sort().join(','))}`,
  )
}

export function searchRemote(q: string, type: 'etf' | 'crypto' = 'etf') {
  return get<SearchItem[]>(`/api/search?q=${encodeURIComponent(q)}&type=${type}`)
}

/** 국내 상장 ETF 전체 목록 [코드, 이름, 분류] — 하루 동안 브라우저에 캐시 */
export type KrEtfRow = [string, string, number]
const KR_KEY = 'etf-planner/kr-etfs-v2'
let krPromise: Promise<KrEtfRow[]> | null = null

export function loadKrEtfs(): Promise<KrEtfRow[]> {
  if (krPromise) return krPromise
  try {
    const raw = localStorage.getItem(KR_KEY)
    if (raw) {
      const { at, rows } = JSON.parse(raw) as { at: number; rows: KrEtfRow[] }
      if (Date.now() - at < 86_400_000 && rows.length) return (krPromise = Promise.resolve(rows))
    }
  } catch {
    // 캐시를 못 읽으면 새로 받음
  }
  krPromise = get<KrEtfRow[]>('/api/etfs').then((rows) => {
    try {
      localStorage.setItem(KR_KEY, JSON.stringify({ at: Date.now(), rows }))
    } catch {
      // noop
    }
    return rows
  })
  krPromise.catch(() => (krPromise = null))
  return krPromise
}

/** 자산군별 기초지수 장기 평균 — 하루 동안 브라우저에 캐시 */
const BENCH_KEY = 'etf-planner/benchmarks-v1'
export async function loadBenchmarks(): Promise<Record<string, import('./expected').Benchmark>> {
  try {
    const raw = localStorage.getItem(BENCH_KEY)
    if (raw) {
      const { at, data } = JSON.parse(raw)
      if (Date.now() - at < 86_400_000 && Object.keys(data).length) return data
    }
  } catch {
    // 캐시를 못 읽으면 새로 받음
  }
  const data = await get<Record<string, import('./expected').Benchmark>>('/api/benchmarks')
  try {
    localStorage.setItem(BENCH_KEY, JSON.stringify({ at: Date.now(), data }))
  } catch {
    // noop
  }
  return data
}

export interface ChatTurn {
  role: 'user' | 'model'
  text: string
}

/** 모아(Gemini)에게 질문 — 실패하면 code(nokey·password·limit 등)와 안내 문구를 돌려줌 */
export async function sendChat(messages: ChatTurn[], context: string, password: string) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context, password }),
    })
    const j = (await res.json().catch(() => ({}))) as { text?: string; code?: string; error?: string }
    if (res.ok && j.text) return { ok: true as const, text: j.text }
    return { ok: false as const, code: j.code ?? 'fail', error: j.error ?? '모아가 지금 대답하지 못했어요.' }
  } catch {
    return { ok: false as const, code: 'network', error: '인터넷 연결을 확인해 주세요.' }
  }
}
