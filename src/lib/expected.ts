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
  // 코인 ETF(IBIT 등) — 비트코인 과거 성과(연 50%+)는 예측에 쓰기엔 변동이 너무 커서 보수적인 고정값
  crypto: { label: '가상자산(코인 ETF)', anchor: 8 },
  // 채권혼합·TDF·TRF 등 주식과 채권을 섞은 상품 — 주식·채권의 중간값
  balanced: { label: '주식·채권 혼합', anchor: 6 },
  equity: { label: '주식형(기타)', anchor: 7 },
} satisfies Record<string, AssetClass>

export type AssetClassId = keyof typeof ASSET_CLASSES

const US = /미국|(^|\s)us\b|u\.s\.|s&p|나스닥|nasdaq|다우|dow|schwab|vanguard|ishares|spdr/i

/** 한국·미국이 아닌 해외 시장 */
const FOREIGN = /중국|차이나|china|한중|홍콩|항셍|심천|인도|india|베트남|신흥|이머징|emerging|\bem\b|em선물|일본|japan|유럽|유로|euro|독일|dax|stoxx|대만|taiwan|tsmc|아시아|러시아|멕시코|라틴|필리핀|인도네시아|샤오미|byd/i
const KOREA = /코리아|한국|코스피|코스닥/i

const RULES: [RegExp, AssetClassId | ((name: string) => AssetClassId)][] = [
  [/비트코인|이더리움|bitcoin|ethereum|ether\b|가상자산|암호화폐|crypto|\bibit\b|\bfbtc\b|\bbito\b|\betha\b/i, 'crypto'],
  [/인버스|inverse|bear\b|\bsqqq\b|\bpsq\b|\bsh\b/i, 'inverse'],
  [/레버리지|2x|3x|ultra|tqqq|soxl|upro|bull/i, 'leveraged'],
  [/커버드콜|covered call|premium income|jepi|jepq|qyld|xyld/i, 'coveredCall'],
  // 채권혼합50 같은 상품은 주식이 절반 — 채권보다 먼저 확인
  [/채권혼합|국채혼합|미국채혼합|주식혼합|\btdf|\btrf|자산배분|멀티에셋/i, 'balanced'],
  [/cd\d*년?금리|kofr|sofr|머니마켓|mmf|단기채|단기통안|초단기|단기자금|단기(특수|금융|국공|은행)|전단채|통안채|금리액티브|금리플러스|달러선물|엔선물|sgov|\bbil\b|\bshv\b/i, 'cash'],
  [/30년|20년|장기채|장기국채|\btlt\b|\bedv\b|long[- ]term|20\+/i, 'bondLong'],
  [/채권|국채|국고채|회사채|금융채|은행채|특수채|국공채|물가채|크레딧|하이일드|bond|treasury|t-note|\bief\b|\bagg\b|\bbnd\b/i, 'bond'],
  [/금현물|국제금|금액티브|골드|금선물|\bgold\b|\bgld\b|\biau\b/i, 'gold'],
  // 원유·천연가스 '기업' ETF는 원자재가 아니라 에너지 주식
  [
    /원유|은선물|은현물|은액티브|구리|원자재|천연가스|농산물|콩선물|팔라듐|백금|탄소배출권|commodit|\boil\b|silver/i,
    (n) => (/기업|밸류체인|인프라/.test(n) ? (US.test(n) ? 'usLarge' : 'equity') : 'commodity'),
  ],
  // '인프라'는 넣지 않음 — AI전력인프라 같은 주식형 ETF가 리츠로 잡히지 않게
  [/리츠|reit|부동산|real estate|\bvnq\b/i, 'reits'],
  [/반도체|semicon|\bsox|\bsmh\b/i, 'semis'],
  // '코리아배당다우존스'처럼 '다우'가 들어가도 한국이면 국내 배당
  [
    /배당|dividend|schd|\bvym\b|dgro|고배당/i,
    (n) =>
      /미국/.test(n)
        ? 'usDividend'
        : KOREA.test(n)
          ? 'krDividend'
          : FOREIGN.test(n)
            ? 'intl'
            : US.test(n)
              ? 'usDividend'
              : 'krDividend',
  ],
  // 차이나테크·코리아테크는 미국 기술주가 아님
  [
    /나스닥|nasdaq|qqq|테크|tech|빅테크|fang|테슬라|엔비디아|구글|알파벳|마이크로소프트|애플|아마존|팔란티어|브로드컴/i,
    (n) =>
      /미국|나스닥|nasdaq/i.test(n)
        ? 'usTech'
        : FOREIGN.test(n)
          ? 'intl'
          : /코스닥/.test(n)
            ? 'kosdaq'
            : KOREA.test(n)
              ? 'krSector'
              : 'usTech',
  ],
  [/코스닥|kosdaq/i, 'kosdaq'],
  [/전세계|글로벌|global|world|acwi|\bvt\b|선진국|developed|토탈월드/i, 'world'],
  [/s&p코리아|코리아로우볼/i, 'kospi'],
  [/s&p|sp500|미국|total stock|\bvti\b|\bvoo\b|\bspy\b|\bivv\b|다우|dow|러셀|russell|select sector|버크셔|일라이릴리/i, 'usLarge'],
  [FOREIGN, 'intl'],
  [/international|ex[- ]us|\bvxus\b|\bvea\b|\befa\b/i, 'intl'],
  // '200'은 숫자의 일부(러셀2000 등)가 아닐 때만
  [/(^|\D)200(\D|$)|코스피|kospi|msci korea|krx ?300|코리아밸류업|밸류업/i, 'kospi'],
]

/** 분류에 쓸 글자 — 국내 상장은 종목코드(예: 0072X0)의 영문이 레버리지(2X) 등으로 잘못 걸리지 않게 이름만 */
export function classifyText(name: string, symbol: string) {
  return /\.(KS|KQ)$/.test(symbol) ? name : `${name} ${symbol}`
}

/**
 * 네이버 금융 ETF 분류 코드 — 1 국내 시장지수, 2 국내 업종·테마, 3 국내 파생, 4 해외 주식, 5 원자재, 6 채권, 7 기타
 * 네이버 분류에도 오류가 있어서(예: 토탈월드스탁이 국내 지수), 이름으로 확실히 정하지 못한
 * 경우(국내 업종·기타 주식·'글로벌')에만 공식 분류를 따릅니다.
 */
function checkWithNaver(cls: AssetClassId, tab: number | undefined, text: string): AssetClassId {
  const weak = cls === 'krSector' || cls === 'equity' || cls === 'world'
  const named = FOREIGN.test(text) || /미국|월드|world/i.test(text)
  switch (tab) {
    case 1:
    case 2:
      return cls === 'world' && !named ? 'krSector' : cls
    case 4:
      return ['kospi', 'kosdaq', 'krSector', 'krDividend'].includes(cls) ? 'world' : cls
    case 5:
      return weak ? 'commodity' : cls
    case 6:
      return weak ? 'bond' : cls
    default:
      return cls
  }
}

/** @param tab 국내 ETF의 네이버 분류 코드 (있으면 이름 규칙 결과를 바로잡는 데 사용) */
export function assetClassOf(name: string, symbol: string, tab?: number): AssetClassId {
  const text = classifyText(name, symbol)
  for (const [re, cls] of RULES) {
    if (re.test(text)) return checkWithNaver(typeof cls === 'function' ? cls(text) : cls, tab, text)
  }
  // 국내 상장인데 규칙에 안 걸리면 업종·테마형으로 간주
  return checkWithNaver(/\.(KS|KQ)$/.test(symbol) ? 'krSector' : 'equity', tab, text)
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
  const assetClass = assetClassOf(h.name, h.symbol, h.stats?.tab)
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
