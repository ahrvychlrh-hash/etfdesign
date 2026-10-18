// ETF 자산군 분류 검사 — `npm test`로 실행 (Node 22.6 이상, .ts를 바로 읽음)
// 분류 규칙(src/lib/expected.ts)을 고칠 때 아래 ETF들이 엉뚱한 자산군으로 바뀌지 않는지 확인합니다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assetClassOf } from '../src/lib/expected.ts'

/** [이름, 심볼, 기대 자산군, 네이버 분류 코드(선택)] */
const CASES = [
  // 리츠 — '인프라'만 있는 주식형 ETF는 리츠가 아님
  ['TIGER 리츠부동산인프라', '329200.KS', 'reits'],
  ['KODEX 미국AI전력핵심인프라', '487230.KS', 'usLarge'],
  ['TIGER S&P글로벌인프라(합성)', '000000.KS', 'world'],
  ['Vanguard Real Estate', 'VNQ', 'reits'],
  // 종목코드의 영문(2X 등)이 레버리지로 잡히지 않게
  ['마이티 200TR', '0072X0.KS', 'kospi'],
  ['KODEX 레버리지', '122630.KS', 'leveraged'],
  ['KODEX 200선물인버스2X', '252670.KS', 'inverse'],
  // 국내 지수 — '2000'(러셀)은 코스피가 아님
  ['KODEX 200TR', '278530.KS', 'kospi'],
  ['iShares Russell 2000', 'IWM', 'usLarge'],
  ['TIME 코스닥액티브', '0162Y0.KS', 'kosdaq'],
  // 미국
  ['TIGER 미국S&P500', '360750.KS', 'usLarge'],
  ['Vanguard S&P 500', 'VOO', 'usLarge'],
  ['KODEX 미국나스닥100', '379810.KS', 'usTech'],
  ['Invesco QQQ Trust', 'QQQ', 'usTech'],
  ['ACE 테슬라밸류체인액티브', '000000.KS', 'usTech'],
  // 배당 — '다우'가 들어가도 한국이면 국내 배당
  ['Schwab US Dividend Equity', 'SCHD', 'usDividend'],
  ['TIGER 미국배당다우존스', '458730.KS', 'usDividend'],
  ['TIGER 코리아배당다우존스', '000000.KS', 'krDividend'],
  ['PLUS 자사주매입고배당주', '0098N0.KS', 'krDividend'],
  ['KODEX 대만테크고배당다우존스', '000000.KS', 'intl'],
  // 테크 — 중국·한국 테크는 미국 기술주가 아님
  ['TIGER 차이나항셍테크', '000000.KS', 'intl'],
  ['TIGER 코리아테크액티브', '000000.KS', 'krSector'],
  ['TIGER 코스닥150바이오테크', '000000.KS', 'kosdaq'],
  // 해외
  ['iShares MSCI Emerging Markets ex China', 'EMXC', 'intl'],
  ['Vanguard Total International Stock', 'VXUS', 'intl'],
  ['TIGER 유로스탁스50(합성 H)', '000000.KS', 'intl'],
  ['KIWOOM 독일DAX', '000000.KS', 'intl'],
  ['TIGER 한중전기차(합성)', '000000.KS', 'intl'],
  ['Vanguard Total World Stock', 'VT', 'world'],
  ['TIGER 토탈월드스탁액티브', '000000.KS', 'world', 1],
  // 채권·현금성
  ['iShares 20+ Year Treasury Bond', 'TLT', 'bondLong'],
  ['KODEX 국고채3년', '000000.KS', 'bond'],
  ['TIGER 12월자동연장금융채(AA-이상)액티브', '000000.KS', 'bond'],
  ['KODEX iShares미국하이일드액티브', '000000.KS', 'bond'],
  ['TIGER 미국초단기(3개월이하)국채', '0046A0.KS', 'cash'],
  ['KODEX CD1년금리플러스액티브(합성)', '000000.KS', 'cash'],
  ['RISE 단기특수은행채액티브', '000000.KS', 'cash'],
  ['KODEX 미국달러선물', '000000.KS', 'cash'],
  ['iShares 0-3 Month Treasury Bond', 'SGOV', 'cash'],
  // 혼합형
  ['TIGER 미국테크TOP10채권혼합', '472170.KS', 'balanced'],
  ['KODEX TDF2050액티브 적격', '000000.KS', 'balanced'],
  // 금·원자재 — 원유 '기업' ETF는 주식
  ['금 현물 (금통장)', 'GOLD-G', 'gold'],
  ['KODEX 금액티브', '000000.KS', 'gold'],
  ['SOL 국제금', '000000.KS', 'gold'],
  ['TIGER 은액티브', '000000.KS', 'commodity'],
  ['KODEX 콩선물(H)', '000000.KS', 'commodity'],
  ['KIWOOM 미국원유에너지기업', '000000.KS', 'usLarge'],
  // 커버드콜·코인 ETF
  ['JPMorgan Equity Premium Income', 'JEPI', 'coveredCall'],
  ['iShares Bitcoin Trust ETF', 'IBIT', 'crypto'],
  // 네이버 분류로 바로잡는 경우 — 이름만으로 모를 때만
  ['WON K-글로벌수급상위', '000000.KS', 'krSector', 2],
  ['RISE 미국S&P500엔화노출(합성 H)', '000000.KS', 'usLarge', 6],
]

for (const [name, symbol, expected, tab] of CASES) {
  test(`${name} → ${expected}`, () => {
    assert.equal(assetClassOf(name, symbol, tab), expected)
  })
}
