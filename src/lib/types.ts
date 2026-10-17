export interface Profile {
  age: number
  /** 모으고 싶은 목표 금액 (원) */
  target: number
  /** 매달 투자 가능한 금액 (원) */
  monthly: number
  /** 배당금 재투자 여부 */
  reinvest: boolean
  createdAt: string
}

/** 서버에서 받아온 ETF 시세·과거 성과 */
export interface EtfStats {
  currency: string
  nativePrice: number
  fx: number
  /** 최근 최대 30년 가격 연평균 수익률 (소수) */
  priceCagr: number | null
  /** 최근 최대 30년 배당 재투자 포함 연평균 수익률 (소수) */
  totalCagr: number | null
  /** 위 수익률을 계산한 기간(년) */
  years: number
  /** 최근 12개월 1주당 배당금 (원화) */
  divPerShare: number
  /** 최근 12개월 배당 지급 월 */
  payMonths: number[]
  updatedAt: string
}

export const ACCOUNT_KINDS = ['일반', 'ISA', '연금저축', 'IRP', '해외주식'] as const
export type AccountKind = (typeof ACCOUNT_KINDS)[number]

export interface Account {
  id: string
  name: string
  kind: AccountKind
}

export interface Holding {
  id: string
  accountId: string
  /** Yahoo 형식 심볼 (예: 360750.KS, VOO) */
  symbol: string
  name: string
  quantity: number
  /** 총 투자금(매입금액, 원) — 평균매입가 = 투자금 ÷ 수량 */
  invested: number
  /** 원화 현재가 — 평가금 = 수량 × 현재가 */
  currentPrice: number
  /** auto: 시세 자동 반영, manual: 직접 입력한 평가금 기준 */
  priceMode: 'auto' | 'manual'
  stats?: EtfStats
}

export interface AppState {
  profile: Profile | null
  accounts: Account[]
  holdings: Holding[]
}
