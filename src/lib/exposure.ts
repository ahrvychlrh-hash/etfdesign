import type { Holding } from './types'
import { assetClassOf, type AssetClassId } from './expected'
import { holdingValue } from './finance'

/**
 * 나라별·섹터별·자산군 비중 추정
 *
 * ETF 구성종목 데이터는 무료로 받기 어려워서, ETF 이름으로 기초지수를 판별하고
 * 그 지수의 대표 구성 비율(대략값)을 씁니다. 테마 ETF(반도체·바이오 등)는 해당 섹터 100%로 봅니다.
 */

type Mix = Record<string, number>

const US = /미국|(^|\s)us\b|u\.s\.|s&p|나스닥|nasdaq|다우|dow|필라델피아|schwab|vanguard|ishares|spdr|invesco|jpmorgan|proshares|global x|\b(voo|spy|ivv|vti|qqq|qqqm|schd|vym|dgro|jepi|jepq|soxx|smh|tlt|ief|bnd|sgov|tqqq)\b/i

/* ---------- 자산군 ---------- */

export const ASSET_BUCKETS = ['주식', '채권', '금·원자재', '현금성', '리츠', '인버스'] as const

function assetBucket(cls: AssetClassId): (typeof ASSET_BUCKETS)[number] {
  if (cls === 'bond' || cls === 'bondLong') return '채권'
  if (cls === 'gold' || cls === 'commodity') return '금·원자재'
  if (cls === 'cash') return '현금성'
  if (cls === 'reits') return '리츠'
  if (cls === 'inverse') return '인버스'
  return '주식'
}

/* ---------- 나라 ---------- */

const WORLD: Mix = { 미국: 62, 유럽: 15, 일본: 5, 신흥국: 10, '기타 선진국': 8 }
const EM: Mix = { 중국: 22, 대만: 20, 인도: 20, 한국: 12, '기타 신흥국': 26 }
const EM_EX_CHINA: Mix = { 대만: 28, 인도: 27, 한국: 15, '기타 신흥국': 30 }

function countryMix(h: Holding, cls: AssetClassId): Mix {
  const n = `${h.name} ${h.symbol}`
  const us = US.test(n)
  // '중국 제외' 신흥국 ETF가 중국으로 잡히지 않게 먼저 확인
  if (/ex[- ]?china|emxc|중국제외/i.test(n)) return EM_EX_CHINA
  if (/중국|차이나|china|홍콩|항셍/i.test(n)) return { 중국: 100 }
  if (/인도|india/i.test(n)) return { 인도: 100 }
  if (/일본|japan|니케이|topix/i.test(n)) return { 일본: 100 }
  if (/베트남|vietnam/i.test(n)) return { 베트남: 100 }
  if (/대만|taiwan/i.test(n)) return { 대만: 100 }
  if (/유럽|euro|stoxx/i.test(n)) return { 유럽: 100 }
  if (cls === 'gold' || cls === 'commodity') return { '국가 무관(원자재)': 100 }
  if (cls === 'world' || cls === 'equity') return /global|글로벌|전세계|world|acwi|\bvt\b/i.test(n) ? WORLD : us ? { 미국: 100 } : WORLD
  if (cls === 'intl') return /ex[- ]?china|emxc|중국제외/i.test(n) ? EM_EX_CHINA : EM
  if (['usLarge', 'usTech', 'usDividend'].includes(cls)) return { 미국: 100 }
  if (['kospi', 'kosdaq', 'krSector', 'krDividend'].includes(cls)) return { 한국: 100 }
  // 반도체·커버드콜·채권·현금·리츠·레버리지·인버스는 이름으로 나라 판별
  return us || !/\.(KS|KQ)$/.test(h.symbol) ? { 미국: 100 } : { 한국: 100 }
}

/* ---------- 섹터 (주식 부분만) ---------- */

export const SECTORS = [
  'IT',
  '금융',
  '헬스케어',
  '경기소비재',
  '산업재',
  '커뮤니케이션',
  '필수소비재',
  '에너지',
  '소재',
  '유틸리티',
  '부동산',
] as const

/** 전세계 주식(ACWI) 섹터 비중 — '적정' 판단 기준 */
export const WORLD_SECTOR_REF: Mix = {
  IT: 26,
  금융: 17,
  헬스케어: 10,
  경기소비재: 11,
  산업재: 11,
  커뮤니케이션: 8,
  필수소비재: 6,
  에너지: 4,
  소재: 4,
  유틸리티: 3,
  부동산: 2,
}

const SP500: Mix = { IT: 32, 금융: 13, 헬스케어: 10, 경기소비재: 10, 커뮤니케이션: 9, 산업재: 8, 필수소비재: 6, 에너지: 3, 유틸리티: 2.5, 부동산: 2, 소재: 2 }
const NDX: Mix = { IT: 50, 커뮤니케이션: 15, 경기소비재: 14, 헬스케어: 6, 필수소비재: 5, 산업재: 5, 유틸리티: 1, 소재: 1 }
const US_DIV: Mix = { 에너지: 19, 필수소비재: 18, 헬스케어: 15, 산업재: 13, 금융: 9, IT: 8, 경기소비재: 8, 커뮤니케이션: 5, 소재: 3, 유틸리티: 2 }
const KOSPI: Mix = { IT: 38, 산업재: 14, 금융: 11, 경기소비재: 10, 헬스케어: 8, 소재: 7, 커뮤니케이션: 5, 필수소비재: 3, 에너지: 2, 유틸리티: 2 }
const KOSDAQ: Mix = { 헬스케어: 30, IT: 30, 산업재: 15, 소재: 8, 경기소비재: 7, 커뮤니케이션: 7, 필수소비재: 3 }
const KR_DIV: Mix = { 금융: 45, 산업재: 12, 경기소비재: 10, 커뮤니케이션: 10, 소재: 8, 에너지: 5, 유틸리티: 5, IT: 5 }
const EM_SECTOR: Mix = { IT: 24, 금융: 23, 경기소비재: 13, 커뮤니케이션: 9, 산업재: 7, 소재: 6, 필수소비재: 5, 에너지: 5, 헬스케어: 4, 유틸리티: 3, 부동산: 1 }

const THEMES: [RegExp, string][] = [
  [/반도체|semicon|\bsox|\bsmh\b|인공지능|소프트웨어|인터넷|사이버|cyber|클라우드|cloud|테크|tech|플랫폼|로봇/i, 'IT'],
  // 'AI'는 대문자로만 (Daily 같은 단어에 걸리지 않게)
  [/(^|[^A-Za-z])AI([^A-Za-z]|$)/, 'IT'],
  [/바이오|헬스|제약|의료|bio|health|pharma/i, '헬스케어'],
  [/2차전지|배터리|battery|리튬|소재|화학|철강|비철/i, '소재'],
  [/은행|금융|증권|보험|bank|financ|지주/i, '금융'],
  [/방산|조선|기계|건설|원전|인프라|운송|산업|industr|우주|항공/i, '산업재'],
  [/에너지|정유|energy|태양광|수소/i, '에너지'],
  [/자동차|여행|화장품|리테일|consumer|소비재|명품|럭셔리/i, '경기소비재'],
  [/필수소비|음식료|staples/i, '필수소비재'],
  [/미디어|엔터|게임|통신|media|컨텐츠|콘텐츠/i, '커뮤니케이션'],
  [/유틸리티|전력|utilities/i, '유틸리티'],
]

function sectorMix(h: Holding, cls: AssetClassId): Mix | null {
  if (assetBucket(cls) !== '주식') return null
  const n = `${h.name} ${h.symbol}`
  if (cls === 'semis') return { IT: 100 }
  // 지수형이 아닌 테마형은 테마 섹터로
  const broad = /200|코스피|kospi|s&p|500|나스닥100|nasdaq 100|qqq|다우|total|전세계|msci|top/i.test(n)
  if (!broad || cls === 'krSector' || cls === 'equity' || cls === 'world') {
    for (const [re, sector] of THEMES) if (re.test(n)) return { [sector]: 100 }
  }
  switch (cls) {
    case 'usLarge':
      return SP500
    case 'usTech':
      return NDX
    case 'usDividend':
      return US_DIV
    case 'krDividend':
      return KR_DIV
    case 'kospi':
    case 'krSector':
      return KOSPI
    case 'kosdaq':
      return KOSDAQ
    case 'intl':
      return EM_SECTOR
    case 'coveredCall':
    case 'leveraged':
      if (/나스닥|nasdaq|qqq|tqqq|jepq/i.test(n)) return NDX
      if (/배당|dividend|다우|dow/i.test(n)) return US.test(n) ? US_DIV : KR_DIV
      if (/코스닥/.test(n)) return KOSDAQ
      return US.test(n) || !/\.(KS|KQ)$/.test(h.symbol) ? SP500 : KOSPI
    default:
      return WORLD_SECTOR_REF
  }
}

/* ---------- 합산 ---------- */

function addMix(acc: Mix, mix: Mix, value: number) {
  const sum = Object.values(mix).reduce((a, b) => a + b, 0)
  for (const [k, w] of Object.entries(mix)) acc[k] = (acc[k] ?? 0) + (value * w) / sum
}

export interface Slice {
  key: string
  value: number
  pct: number
}

function toSlices(acc: Mix): Slice[] {
  const total = Object.values(acc).reduce((a, b) => a + b, 0)
  return Object.entries(acc)
    .map(([key, value]) => ({ key, value, pct: total > 0 ? (value / total) * 100 : 0 }))
    .filter((s) => s.pct >= 0.05)
    .sort((a, b) => b.value - a.value)
}

export function portfolioExposure(holdings: Holding[]) {
  const asset: Mix = {}
  const country: Mix = {}
  const sector: Mix = {}
  for (const h of holdings) {
    const v = holdingValue(h)
    if (v <= 0) continue
    const cls = assetClassOf(h.name, h.symbol)
    asset[assetBucket(cls)] = (asset[assetBucket(cls)] ?? 0) + v
    addMix(country, countryMix(h, cls), v)
    const sm = sectorMix(h, cls)
    if (sm) addMix(sector, sm, v)
  }
  return { asset: toSlices(asset), country: toSlices(country), sector: toSlices(sector) }
}

/* ---------- 높음 / 적정 / 낮음 판단 ---------- */

export type Level = 'high' | 'ok' | 'low'

export interface Judged extends Slice {
  level: Level
  /** 적정 범위 (%) */
  range: [number, number]
}

/** 나라: 미국 30~75%, 한국 5~40%, 그 외 한 나라 25% 이하를 적정으로 봅니다. */
export function judgeCountries(slices: Slice[]): Judged[] {
  return slices.map((s) => {
    const range: [number, number] =
      s.key === '미국' ? [30, 75] : s.key === '한국' ? [5, 40] : s.key.startsWith('국가 무관') ? [0, 30] : [0, 25]
    return { ...s, range, level: s.pct > range[1] ? 'high' : s.pct < range[0] ? 'low' : 'ok' }
  })
}

/**
 * 섹터: 전세계 주식 섹터 비중(ACWI)을 기준으로
 * 기준의 1.8배(또는 +10%p) 넘으면 높음, 주요 섹터가 기준의 40% 미만이면 낮음.
 */
export function judgeSectors(slices: Slice[]): (Judged & { ref: number })[] {
  const present = new Map(slices.map((s) => [s.key, s]))
  // 주요 섹터는 0%여도 '낮음'으로 보여주기 위해 포함
  for (const key of ['IT', '금융', '헬스케어', '경기소비재', '산업재']) {
    if (!present.has(key) && slices.length) present.set(key, { key, value: 0, pct: 0 })
  }
  return [...present.values()]
    .map((s) => {
      const ref = WORLD_SECTOR_REF[s.key] ?? 3
      const hi = Math.max(ref * 1.8, ref + 10)
      const lo = ref >= 8 ? ref * 0.4 : 0
      const range: [number, number] = [Math.round(lo), Math.round(hi)]
      return { ...s, ref, range, level: (s.pct > hi ? 'high' : s.pct < lo ? 'low' : 'ok') as Level }
    })
    .sort((a, b) => b.pct - a.pct)
}
