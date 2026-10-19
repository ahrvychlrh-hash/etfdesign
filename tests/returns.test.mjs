// 전체 수익률 검사 — `npm test`로 실행
// 원금 = 매입금액 합계 − 재투자 합계, 수익금 = 평가금 − 원금 (= 평가 손익 + 재투자)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { realPrincipal } from '../src/lib/history.ts'

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
