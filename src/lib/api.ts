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
      updatedAt: new Date().toISOString(),
    },
  }
}

export function searchRemote(q: string) {
  return get<SearchItem[]>(`/api/search?q=${encodeURIComponent(q)}`)
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

/* ---------------- 증권 앱 캡처 읽기 ---------------- */

export interface ScannedHolding {
  name: string
  code: string | null
  quantity: number | null
  invested: number | null
  value: number | null
  avgPrice: number | null
  currentPrice: number | null
  currency: 'KRW' | 'USD'
}

/** 긴 변 기준으로 줄여서 JPEG base64로 — 업로드 용량을 줄이고 인식 비용도 아낌 */
async function shrink(file: File, maxSide = 1600): Promise<{ mediaType: string; data: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const url = canvas.toDataURL('image/jpeg', 0.85)
  return { mediaType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) }
}

export async function scanScreenshots(files: File[]): Promise<ScannedHolding[]> {
  const images = await Promise.all(files.map((f) => shrink(f)))
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
  return (body as { holdings: ScannedHolding[] }).holdings
}
