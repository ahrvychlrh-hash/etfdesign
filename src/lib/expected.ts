import type { Holding } from './types'

/**
 * 기대 수익률 산출
 *
 * 1) ETF 이름으로 자산군을 나눕니다. (예: TIME 코스닥액티브 → 코스닥)
 * 2) ETF가 30년 이상 상장돼 있으면 그 ETF의 실제 30년 연평균 수익률을 씁니다.
 * 3) 그보다 짧으면 ETF 자체 성과 대신 기초지수의 장기(최대 30년) 연평균 수익률을 씁니다.
 *    (예: 코스닥 액티브 ETF → 코스닥 지수 평균) — 짧은 기간의 급등·급락이 반영되지 않게.
 * 4) 기초지수 데이터를 못 받으면 자산군별 고정 장기 평균값(anchor)을 씁니다.
 * 5) 재투자 OFF면 최근 12개월 배당수익률만큼 빼서 "가격 상승분"만 남깁니다.
 */

/** 서버에서 받은 기초지수 장기 평균 (자산군 → 값) */
export interface Benchmark {
  label: string
  symbol: string
  rate: number
  years: number
}
let benchmarks: Record<string, Benchmark> = {}

export function setBenchmarks(b: Record<string, Benchmark>) {
  benchmarks = b
}

interface AssetClass {
  label: string
  /** 30년 장기 평균 연수익률 (%, 배당 재투자 포함, 보수적으로 반올림) */
  anchor: number
}

export const ASSET_CLASSES = {
  usLarge: { label: '미국 대형주(S&P500)', anchor: 10 },
  usTech: { label: '미국 기술주(나스닥100)', anchor: 12 },
  semis: { label: '반도체', anchor: 12 },
  usDividend: { label: '미국 배당주', anchor: 9.5 },
  krDividend: { label: '국내 배당주', anchor: 7.5 },
  kospi: { label: '국내 대형주(코스피)', anchor: 6.5 },
  kosdaq: { label: '코스닥', anchor: 2 },
  krSector: { label: '국내 업종·테마', anchor: 6 },
  world: { label: '전세계 주식', anchor: 8 },
  intl: { label: '해외(신흥국·기타)', anchor: 5 },
  coveredCall: { label: '커버드콜', anchor: 7 },
  bondLong: { label: '장기 국채', anchor: 4.5 },
  bond: { label: '채권', anchor: 4 },
  cash: { label: '단기채·금리형', anchor: 3 },
  gold: { label: '금', anchor: 7 },
  commodity: { label: '원자재', anchor: 3 },
  reits: { label: '리츠·부동산', anchor: 6.5 },
  leveraged: { label: '레버리지', anchor: 5 },
  inverse: { label: '인버스', anchor: -4 },
  // 코인은 총자산에만 넣고 수익률 계산에서는 빼므로(plan.ts) 표시용 분류만
  crypto: { label: '가상자산', anchor: 0 },
  equity: { label: '주식형(기타)', anchor: 7 },
} satisfies Record<string, AssetClass>

export type AssetClassId = keyof typeof ASSET_CLASSES

const US = /미국|(^|\s)us\b|u\.s\.|s&p|나스닥|nasdaq|다우|dow|schwab|vanguard|ishares|spdr/i

const RULES: [RegExp, AssetClassId | ((name: string) => AssetClassId)][] = [
  [/-USD$|비트코인|이더리움|bitcoin|ethereum|가상자산|암호화폐|crypto/i, 'crypto'],
  [/인버스|inverse|bear\b|\bsqqq\b|\bpsq\b|\bsh\b/i, 'inverse'],
  [/레버리지|2x|3x|ultra|tqqq|soxl|upro|bull/i, 'leveraged'],
  [/커버드콜|covered call|premium income|jepi|jepq|qyld|xyld/i, 'coveredCall'],
  [/cd금리|kofr|머니마켓|mmf|단기채|단기통안|초단기|단기자금|금리액티브|sgov|\bbil\b|\bshv\b/i, 'cash'],
  [/30년|20년|장기채|장기국채|\btlt\b|\bedv\b|long[- ]term|20\+/i, 'bondLong'],
  [/채권|국채|국고채|회사채|크레딧|bond|treasury|t-note|\bief\b|\bagg\b|\bbnd\b/i, 'bond'],
  [/금현물|골드|금선물|\bgold\b|\bgld\b|\biau\b/i, 'gold'],
  [/원유|은선물|구리|원자재|천연가스|농산물|commodit|\boil\b/i, 'commodity'],
  [/리츠|reit|부동산|인프라/i, 'reits'],
  [/반도체|semicon|\bsox|\bsmh\b/i, 'semis'],
  [/배당|dividend|schd|\bvym\b|dgro|고배당/i, (n) => (US.test(n) ? 'usDividend' : 'krDividend')],
  [/나스닥|nasdaq|qqq|테크|tech|빅테크|fang/i, 'usTech'],
  [/코스닥|kosdaq/i, 'kosdaq'],
  [/s&p|sp500|미국|total stock|\bvti\b|\bvoo\b|\bspy\b|\bivv\b|다우|dow/i, 'usLarge'],
  [/전세계|글로벌|global|world|acwi|\bvt\b|선진국|developed/i, 'world'],
  [/중국|차이나|china|인도|india|베트남|신흥|emerging|일본|japan|유럽|euro|대만|taiwan/i, 'intl'],
  [/200|코스피|kospi|msci korea|krx ?300|코리아밸류업|밸류업/i, 'kospi'],
]

export function assetClassOf(name: string, symbol: string): AssetClassId {
  const text = `${name} ${symbol}`
  for (const [re, cls] of RULES) {
    if (re.test(text)) return typeof cls === 'function' ? cls(text) : cls
  }
  // 국내 상장인데 규칙에 안 걸리면 업종·테마형으로 간주
  return /\.(KS|KQ)$/.test(symbol) ? 'krSector' : 'equity'
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

export interface ExpectedBreakdown {
  /** 최종 기대 연수익률 (%) — reinvest 설정 반영 */
  rate: number
  /** 배당 재투자 포함 기대 연수익률 (%) */
  total: number
  /** 가격 상승분만 (%) */
  priceOnly: number
  assetClass: AssetClassId
  /** 무엇을 근거로 했는지 */
  source: 'etf' | 'index' | 'anchor'
  /** 근거가 된 수익률(%)과 기간 */
  basisRate: number
  basisYears: number
  /** 기초지수 이름 (source가 index일 때) */
  indexLabel?: string
  /** ETF 자체 상장 기간(년) */
  etfYears: number
  divYield: number
}

export function expectedBreakdown(
  h: Pick<Holding, 'name' | 'symbol' | 'currentPrice' | 'stats'>,
  reinvest: boolean,
): ExpectedBreakdown {
  const assetClass = assetClassOf(h.name, h.symbol)
  const s = h.stats
  const etfYears = s?.years ?? 0
  const bench = benchmarks[assetClass]
  let source: ExpectedBreakdown['source']
  let basisRate: number
  let basisYears: number
  if (s?.totalCagr != null && etfYears >= 29.5) {
    source = 'etf'
    basisRate = s.totalCagr * 100
    basisYears = etfYears
  } else if (bench) {
    source = 'index'
    basisRate = bench.rate
    basisYears = bench.years
  } else {
    source = 'anchor'
    basisRate = ASSET_CLASSES[assetClass].anchor
    basisYears = 30
  }
  const total = clamp(basisRate, -10, 15)
  const divYield = s && h.currentPrice > 0 ? (s.divPerShare / h.currentPrice) * 100 : 0
  const priceOnly = total - divYield
  return {
    rate: reinvest ? total : priceOnly,
    total,
    priceOnly,
    assetClass,
    source,
    basisRate,
    basisYears,
    indexLabel: bench?.label,
    etfYears,
    divYield,
  }
}
