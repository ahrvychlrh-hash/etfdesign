import { useMemo, useState } from 'react'
import type { Profile } from '../lib/types'
import type { Plan } from '../lib/plan'
import { monthsToTarget, project, requiredMonthly } from '../lib/finance'
import { duration, wonShort } from '../lib/format'
import { ProjectionChart } from './ProjectionChart'
import { Section } from './ui'

interface Props {
  profile: Profile
  plan: Plan
}

interface Sim {
  target: number
  monthly: number
  rate: number
  years: number
}

/** 그래프 기본 기간 — 목표 달성 시점 + 3년 (10~60년) */
function defaultYears(months: number | null) {
  return Math.min(Math.max(months === null ? 30 : Math.ceil(months / 12) + 3, 10), 60)
}

/**
 * 자산 성장 예측 — 목표 금액·월 투자금·수익률·기간을 바꿔 보며 그래프가 어떻게 달라지는지 확인하고,
 * '현재 기록으로'를 누르면 내 실제 설정으로 돌아갑니다.
 */
export function GrowthSection({ profile, plan }: Props) {
  const base: Sim = { target: profile.target, monthly: profile.monthly, rate: Math.round(plan.rate * 10) / 10, years: defaultYears(plan.months) }
  // null이면 현재 기록 그대로
  const [sim, setSim] = useState<Sim | null>(null)
  const s = sim ?? base
  const changed =
    sim !== null &&
    (sim.target !== base.target || sim.monthly !== base.monthly || sim.rate !== base.rate || sim.years !== base.years)
  const set = (patch: Partial<Sim>) => setSim({ ...s, ...patch })

  // 투자 자산만 불어나고, 부동산·비상금·코인은 그대로 더해지는 고정값으로 봄
  const points = useMemo(
    () =>
      project(plan.etf.value, s.monthly, s.rate, profile.age, s.years).map((p) => ({
        ...p,
        value: p.value + plan.fixed,
        contributed: p.contributed + plan.fixed,
      })),
    [plan.etf.value, plan.fixed, s.monthly, s.rate, profile.age, s.years],
  )
  const months = monthsToTarget(plan.etf.value, s.monthly, s.rate, s.target - plan.fixed)
  const by60 = requiredMonthly(plan.etf.value, s.rate, s.target - plan.fixed, Math.max((60 - profile.age) * 12, 1))
  // 월 투자금 막대 범위: 지금의 3배 또는 500만원 중 큰 쪽까지
  const monthlyMax = Math.max(Math.ceil((profile.monthly * 3) / 100_000) * 100_000, 5_000_000)
  // 목표 금액 막대 범위: 1억 ~ 지금 목표의 3배 또는 30억 중 큰 쪽 (1천만원 단위)
  const targetMax = Math.max(Math.ceil((profile.target * 3) / 10_000_000) * 10_000_000, 3_000_000_000)

  return (
    <Section
      title="자산 성장 예측"
      action={
        changed ? (
          <button className="link" onClick={() => setSim(null)}>
            ↺ 현재 기록으로
          </button>
        ) : undefined
      }
    >
      <div className="card">
        <p className="card__note">
          목표 {wonShort(s.target)} · 매달 {wonShort(s.monthly)} · 연 {s.rate.toFixed(1)}% · {s.years}년 {changed ? '(바꿔 보는 중)' : '가정'}
        </p>
        <ProjectionChart points={points} target={s.target} />
        <p className={`sim-result ${changed ? 'is-changed' : ''}`}>
          {months === null
            ? '이 조건으로는 50년 안에 목표에 닿지 않아요.'
            : months === 0
              ? '이미 목표를 이뤘어요!'
              : `목표까지 ${duration(months)} · ${profile.age + Math.ceil(months / 12)}세에 달성`}
        </p>

        <div className="sim">
          <SimSlider
            label="목표 금액"
            value={s.target}
            text={wonShort(s.target)}
            min={100_000_000}
            max={targetMax}
            step={10_000_000}
            onChange={(v) => set({ target: v })}
          />
          <SimSlider
            label="월 투자금"
            value={s.monthly}
            text={wonShort(s.monthly)}
            min={0}
            max={monthlyMax}
            step={100_000}
            onChange={(v) => set({ monthly: v })}
          />
          <SimSlider
            label="연 수익률"
            value={s.rate}
            text={`${s.rate.toFixed(1)}%`}
            min={1}
            max={15}
            step={0.5}
            onChange={(v) => set({ rate: v })}
          />
          <SimSlider label="기간" value={s.years} text={`${s.years}년`} min={5} max={60} step={1} onChange={(v) => set({ years: v })} />
        </div>
        {changed && (
          <button className="btn btn--ghost btn--block sim-reset" onClick={() => setSim(null)}>
            ↺ 현재 기록으로 되돌리기
          </button>
        )}

        {!changed && profile.age < 60 && by60 > profile.monthly && (
          <p className="hint hint--sm">
            60세까지 이루려면 매달 약 <b>{wonShort(by60)}</b>이 필요해요.
          </p>
        )}
        <p className="hint hint--sm">막대를 움직여 보세요. 실제 목표·설정은 바뀌지 않아요.</p>
      </div>
    </Section>
  )
}

function SimSlider(props: {
  label: string
  value: number
  text: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="sim__row">
      <span className="sim__label">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={Math.min(props.value, props.max)}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <b className="sim__value">{props.text}</b>
    </label>
  )
}
