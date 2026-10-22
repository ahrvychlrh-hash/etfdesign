import type { EtfStats } from './types'
import { askGemini } from '../../server/chat'

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

/**
 * 모아(Gemini)에게 질문 — 실패하면 code(nokey·password·limit 등)와 안내 문구를 돌려줌.
 * apiKey(사용자가 연결한 자기 키)가 있으면 우리 서버를 거치지 않고 Google로 바로 물어봄.
 * onText: 답 글자가 만들어지는 대로 받아서 화면에 바로 보여줌.
 */
export async function sendChat(messages: ChatTurn[], context: string, password: string, apiKey?: string, onText?: (t: string) => void) {
  const fail = (code?: string, error?: string) => ({ ok: false as const, code: code ?? 'fail', error: error ?? '모아가 지금 대답하지 못했어요.' })
  try {
    if (apiKey) {
      const out = await askGemini(apiKey, { messages, context }, undefined, onText)
      const j = out.body as { text?: string; code?: string; error?: string }
      return out.status === 200 && j.text ? { ok: true as const, text: j.text } : fail(j.code, j.error)
    }
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context, password }),
    })
    // 키·비밀번호 문제 등은 바로 JSON으로 옴
    if (!res.ok || !res.body || !(res.headers.get('Content-Type') ?? '').includes('ndjson')) {
      const j = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
      return fail(j.code, j.error)
    }
    // 한 줄에 JSON 하나: {"t":"글자"} … {"done":true} 또는 {"code","error"}
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let text = ''
    let end: { done?: boolean; code?: string; error?: string } | null = null
    for (;;) {
      const { done, value } = await reader.read()
      if (value) buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = done ? '' : (lines.pop() ?? '')
      for (const l of lines) {
        if (!l.trim()) continue
        const j = JSON.parse(l) as { t?: string; done?: boolean; code?: string; error?: string }
        if (typeof j.t === 'string') {
          text += j.t
          onText?.(j.t)
        } else end = j
      }
      if (done) break
    }
    if (text.trim() && !end?.code) return { ok: true as const, text: text.trim() }
    return fail(end?.code, end?.error)
  } catch {
    return fail('network', '인터넷 연결을 확인해 주세요.')
  }
}

/** 서버에 Gemini 키가 있는지 — 모르면 null */
export async function fetchChatStatus(): Promise<{ serverKey: boolean; password: boolean } | null> {
  try {
    const res = await fetch('/api/chat')
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}
