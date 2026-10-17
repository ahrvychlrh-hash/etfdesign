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

export const ACCOUNT_KINDS = ['일반', 'ISA', '연금저축', 'IRP', '해외주식', '금통장', '비상금'] as const
export type AccountKind = (typeof ACCOUNT_KINDS)[number]

export interface Account {
  id: string
  name: string
  kind: AccountKind
  /** 현금 잔액 (원) — 비상금 계좌에서 사용 */
  cash?: number
}

/** 비상금 계좌: 총자산에는 넣고 수익률·기록·리밸런싱에서는 뺌 */
export function isReserve(a: Pick<Account, 'kind'>) {
  return a.kind === '비상금'
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
  /** 리밸런싱 목표 비중 (심볼 → %) */
  targets: Record<string, number>
  /** 월말 자산 기록 ('YYYY-MM' → 기록) */
  snapshots: Record<string, Snapshot>
  /** 원금이 아닌 재투자 기록 */
  reinvests: Reinvest[]
  /** 부동산 — 총자산에는 넣고 수익률 계산에서는 뺌 */
  realEstates: RealEstate[]
}

export interface RealEstate {
  id: string
  name: string
  /** 현재 가치 (원) */
  value: number
  memo?: string
}

/** 한 달의 마지막 자산 상태 */
export interface Snapshot {
  /** 평가금 합계 (원) */
  value: number
  /** 실제 원금 = 투자금 합계 - 재투자 합계 (원) */
  principal: number
  /** 마지막으로 기록한 시각 */
  at: string
  /** 직접 입력한 기록이면 자동으로 덮어쓰지 않음 */
  manual?: boolean
}

export interface Reinvest {
  id: string
  /** 'YYYY-MM' */
  month: string
  /** sell: 판 돈을 다시 투자, dividend: 받은 배당을 다시 투자 */
  kind: 'sell' | 'dividend'
  amount: number
  memo?: string
}
