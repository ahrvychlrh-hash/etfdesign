import type { Holding } from './types'

/**
 * 기대 수익률 산출
 *
 * 1) ETF 이름으로 자산군을 나누고, 자산군별 "30년 장기 평균" 연수익률(배당 재투자 포함)을 기준값으로 둡니다.
 * 2) ETF의 실제 성과(최근 최대 30년)를 기간 비율만큼만 반영합니다.
 *    - 30년 이상 데이터: 실제 30년 평균을 그대로 사용
 *    - 5년 데이터: 실제 성과 5/30 + 장기 평균 25/30
 * 3) 짧은 기간에 급등·급락한 ETF가 결과를 끌고 가지 않도록, 30년 미만 데이터는
 *    장기 평균 ±4%p 범위로 잘라서 반영합니다.
 * 4) 재투자 OFF면 최근 12개월 배당수익률만큼 빼서 "가격 상승분"만 남깁니다.
 */

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
  equity: { label: '주식형(기타)', anchor: 7 },
} satisfies Record<string, AssetClass>

export type AssetClassId = keyof typeof ASSET_CLASSES

const US = /미국|(^|\s)us\b|u\.s\.|s&p|나스닥|nasdaq|다우|dow|schwab|vanguard|ishares|spdr/i

const RULES: [RegExp, AssetClassId | ((name: string) => AssetClassId)][] = [
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
  anchor: number
  /** 실제 성과 연평균 (%) — 데이터 없으면 null */
  actual: number | null
  years: number
  /** 실제 성과 반영 비율 (0~1) */
  weight: number
  divYield: number
}

export function expectedBreakdown(h: Pick<Holding, 'name' | 'symbol' | 'currentPrice' | 'stats'>, reinvest: boolean): ExpectedBreakdown {
  const assetClass = assetClassOf(h.name, h.symbol)
  const anchor = ASSET_CLASSES[assetClass].anchor
  const s = h.stats
  const actual = s?.totalCagr != null && s.years >= 1 ? s.totalCagr * 100 : null
  const years = s?.years ?? 0
  const weight = actual == null ? 0 : Math.min(years, 30) / 30
  const adjusted = actual == null ? anchor : years >= 29.5 ? actual : clamp(actual, anchor - 4, anchor + 4)
  const total = clamp(weight * adjusted + (1 - weight) * anchor, -10, 15)
  const divYield = s && h.currentPrice > 0 ? (s.divPerShare / h.currentPrice) * 100 : 0
  const priceOnly = total - divYield
  return {
    rate: reinvest ? total : priceOnly,
    total,
    priceOnly,
    assetClass,
    anchor,
    actual,
    years,
    weight,
    divYield,
  }
}
