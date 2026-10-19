// 전체 수익률 검사 — `npm test`로 실행
// 원금 = 매입금액 합계 − 재투자 합계, 수익금 = 평가금 − 원금 (= 평가 손익 + 재투자)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { monthRows, realPrincipal, yearSummaries } from '../src/lib/history.ts'

const pct = (value, principal) => ((value - principal) / principal) * 100
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`)

test('재투자로 산 것까지 매입금액 1,100만, 재투자 100만, 평가금 2,000만 → 원금 1,000만, +100%', () => {
  const principal = realPrincipal([{ invested: 11_000_000 }], [{ amount: 1_000_000, kind: 'dividend' }])
  assert.equal(principal, 10_000_000)
  close(pct(20_000_000, principal), 100)
})

test('평가손실이어도 재투자 금액을 더하면 실제로는 플러스', () => {
  // 매입금액 1,100만 중 200만은 재투자, 지금 평가금 1,000만 (평가로는 −100만)
  const principal = realPrincipal([{ invested: 11_000_000 }], [{ amount: 2_000_000, kind: 'dividend' }])
  assert.equal(20_000_000 / 2 - principal, 1_000_000)
})

test('다 팔고 다른 ETF를 사도 매도 수익을 기록하면 수익이 0으로 돌아가지 않음', () => {
  // 1,000만으로 산 ETF를 1,500만에 팔고 1,500만으로 새 ETF를 삼 (매도 후 재투자 500만)
  const principal = realPrincipal([{ invested: 15_000_000 }], [{ amount: 5_000_000, kind: 'sell' }])
  close(pct(15_000_000, principal), 50)
})

test('손해 보고 팔았으면 손실(마이너스)을 기록해 원금에 다시 더함', () => {
  // 1,000만으로 산 ETF를 800만에 팔고 800만으로 새 ETF를 삼 (매도 후 재투자 −200만)
  const principal = realPrincipal([{ invested: 8_000_000 }], [{ amount: -2_000_000, kind: 'sell' }])
  assert.equal(principal, 10_000_000)
  close(pct(8_000_000, principal), -20)
})

test('연도별 수익금에 그해 재투자가 한 번만 들어감 (원금이 아니므로 이미 포함)', () => {
  // 1월 1,000만 → 3월에 배당 50만을 재투자 (매입금액 1,050만, 원금은 그대로 1,000만), 3월 말 평가금 1,100만
  const reinvests = [{ id: 'r', month: '2025-03', kind: 'dividend', amount: 500_000 }]
  const principal = realPrincipal([{ invested: 10_500_000 }], reinvests)
  const snaps = {
    '2025-01': { value: 10_000_000, principal: 10_000_000, at: '' },
    '2025-03': { value: 11_000_000, principal, at: '' },
  }
  const [y] = yearSummaries(monthRows(snaps, new Date('2026-01-15')), reinvests)
  assert.equal(y.profit, 1_000_000)
  assert.equal(y.reinvest, 500_000)
})

test('첫 기록 달까지 쌓인 수익도 그해 수익금에 들어가 총 수익금과 같아짐', () => {
  // 1월 첫 기록: 원금 4,700만, 자산 4,929만(+229만) → 10월: 원금 9,988만, 자산 9,875만(-113만)
  const snaps = {
    '2026-01': { value: 49_290_000, principal: 47_000_000, at: '' },
    '2026-10': { value: 98_750_000, principal: 99_880_000, at: '' },
  }
  const [y] = yearSummaries(monthRows(snaps, new Date('2026-10-19')))
  assert.equal(y.profit, 98_750_000 - 99_880_000)
  assert.equal(y.months, 2)
})
