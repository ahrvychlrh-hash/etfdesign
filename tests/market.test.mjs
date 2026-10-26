// 내 수익률과 시장 비교 계산 검사 — `npm test`
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareReturns, indexChange } from '../src/lib/market.ts'

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`)
const row = (month, ret) => ({ month, ret, value: 0, principal: 0, newMoney: 0, profit: 0, gain: 0, gainPct: 0, ongoing: false })

const monthly = {
  kospi: { '2026-01': 2000, '2026-02': 2200, '2026-03': 1980 },
  kosdaq: { '2026-01': 800, '2026-03': 880 },
  sp500: { '2026-01': 5000, '2026-02': 5000, '2026-03': 5500 },
  nasdaq: {},
  usdkrw: { '2026-01': 1300, '2026-02': 1430, '2026-03': 1300 },
}

test('첫 달 말이 0%, 내 수익률은 월 수익률을 이어 곱함', () => {
  const r = compareReturns([row('2026-01', null), row('2026-02', 10), row('2026-03', -10)], monthly, false)
  assert.deepEqual(r.months, ['2026-01', '2026-02', '2026-03'])
  close(r.mine[0], 0)
  close(r.mine[1], 10)
  close(r.mine[2], (1.1 * 0.9 - 1) * 100) // -1%
})

test('지수는 첫 달 말 대비 수익률, 값 없는 달은 비움', () => {
  const r = compareReturns([row('2026-01', null), row('2026-02', 0), row('2026-03', 0)], monthly, false)
  close(r.indices.kospi[1], 10)
  close(r.indices.kospi[2], -1)
  assert.equal(r.indices.kosdaq[1], null)
  close(r.indices.kosdaq[2], 10)
  assert.deepEqual(r.indices.nasdaq, [null, null, null])
})

test('해외 지수 원화로 보기: 그달 환율을 곱함', () => {
  const r = compareReturns([row('2026-01', null), row('2026-02', 0)], monthly, true)
  // S&P500은 그대로인데 환율이 10% 올라 원화로는 +10%
  close(r.indices.sp500[1], 10)
  // 국내 지수는 환율 영향 없음
  close(r.indices.kospi[1], 10)
})

test('기간 시작 달을 정하면 그 달부터 0%', () => {
  const r = compareReturns([row('2026-01', null), row('2026-02', 10), row('2026-03', 5)], monthly, false, '2026-02')
  assert.deepEqual(r.months, ['2026-02', '2026-03'])
  close(r.mine[1], 5)
  close(r.indices.kospi[1], -10)
})

test('기록이 2개월이 안 되면 비교하지 않음', () => {
  assert.equal(compareReturns([row('2026-03', null)], monthly, false), null)
})

test('전일 대비 표시: 금리는 %p, 나머지는 %', () => {
  assert.equal(indexChange({ unit: 'pct', change: 0.035, changePct: 0.7 }), '+0.04%p')
  assert.equal(indexChange({ unit: 'point', change: -80, changePct: -1.456 }), '-1.46%')
})
