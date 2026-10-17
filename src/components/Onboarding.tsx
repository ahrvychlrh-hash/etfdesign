import { useState, type FormEvent } from 'react'
import type { Profile } from '../lib/types'
import { MASCOT_NAME } from '../lib/characters'
import { Mascot } from './Mascot'
import { MoneyInput } from './MoneyInput'
import { monthsToTarget } from '../lib/finance'
import { duration, wonShort } from '../lib/format'

interface Props {
  initial?: Profile | null
  /** 미리보기 계산용: 현재 자산(보유 ETF 합계)과 기대 수익률 */
  currentTotal: number
  rate: number
  rateFromEtf: boolean
  onDone: (p: Profile) => void
  onCancel?: () => void
}

const BIG = [
  { label: '+1,000만', amount: 10_000_000 },
  { label: '+1억', amount: 100_000_000 },
  { label: '+10억', amount: 1_000_000_000 },
]
const SMALL = [
  { label: '+10만', amount: 100_000 },
  { label: '+50만', amount: 500_000 },
  { label: '+100만', amount: 1_000_000 },
]

const STEPS = ['나이', '목표 금액', '월 투자금', '확인'] as const

export function Onboarding({ initial, currentTotal, rate, rateFromEtf, onDone, onCancel }: Props) {
  const [step, setStep] = useState(initial ? STEPS.length - 1 : 0)
  const [age, setAge] = useState(initial?.age ?? 0)
  const [target, setTarget] = useState(initial?.target ?? 0)
  const [monthly, setMonthly] = useState(initial?.monthly ?? 0)

  const valid = [age > 0 && age < 120, target > 0, monthly >= 0, true][step]
  const isLast = step === STEPS.length - 1
  const months = monthsToTarget(currentTotal, monthly, rate, target)

  const bubble = [
    `안녕하세요! 저는 ${MASCOT_NAME}예요.\n먼저 나이를 알려주세요`,
    '얼마를 모으는 게\n목표예요?',
    '매달 얼마씩\n투자할 수 있어요?',
    initial ? '목표를 다시 정리해 볼까요?' : '좋아요!\n이제 같이 모아 봐요',
  ][step]

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    if (!isLast) return setStep(step + 1)
    onDone({
      age,
      target,
      monthly,
      reinvest: initial?.reinvest ?? true,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    })
  }

  return (
    <div className="shell">
      <form className="onb" onSubmit={submit}>
        <div className="onb__hero">
          <div className="onb__top">
            {step > 0 ? (
              <button type="button" className="icon-btn icon-btn--on-blue" onClick={() => setStep(step - 1)} aria-label="이전">
                ‹
              </button>
            ) : onCancel ? (
              <button type="button" className="icon-btn icon-btn--on-blue" onClick={onCancel} aria-label="닫기">
                ✕
              </button>
            ) : (
              <span className="logo">ETF 모아</span>
            )}
            <div className="dots" aria-label={`${STEPS.length}단계 중 ${step + 1}단계`}>
              {STEPS.map((s, i) => (
                <span key={s} className={i === step ? 'is-on' : i < step ? 'is-done' : ''} />
              ))}
            </div>
            {initial && onCancel && step > 0 ? (
              <button type="button" className="icon-btn icon-btn--on-blue" onClick={onCancel} aria-label="닫기">
                ✕
              </button>
            ) : (
              <span style={{ width: 32 }} />
            )}
          </div>
          <div className="onb__stage">
            <p className="bubble bubble--onb" key={bubble}>
              {bubble}
            </p>
            <Mascot className="mascot--onb" />
          </div>
        </div>

        <div className="sheet onb__sheet" key={step}>
          {step === 0 && (
            <>
              <label htmlFor="age" className="q">나이</label>
              <div className="field field--lg field--short">
                <input
                  id="age"
                  inputMode="numeric"
                  autoFocus
                  placeholder="30"
                  value={age || ''}
                  onChange={(e) => setAge(Math.min(Number(e.target.value.replace(/\D/g, '')), 119))}
                />
                <span className="field__suffix">세</span>
              </div>
              <p className="hint">목표 달성 시점을 나이로 알려드릴게요.</p>
            </>
          )}
          {step === 1 && (
            <>
              <label htmlFor="target" className="q">목표 금액</label>
              <MoneyInput id="target" value={target} onChange={setTarget} chips={BIG} autoFocus />
            </>
          )}
          {step === 2 && (
            <>
              <label htmlFor="monthly" className="q">월 투자금</label>
              <MoneyInput id="monthly" value={monthly} onChange={setMonthly} chips={SMALL} autoFocus />
              <p className="hint">무리 없이 꾸준히 넣을 수 있는 금액이 좋아요.</p>
            </>
          )}
          {step === 3 && (
            <>
              <dl className="summary">
                <SummaryRow label="나이" value={`${age}세`} onEdit={() => setStep(0)} />
                <SummaryRow label="목표 금액" value={wonShort(target)} onEdit={() => setStep(1)} />
                <SummaryRow label="월 투자금" value={wonShort(monthly)} onEdit={() => setStep(2)} />
              </dl>
              <p className="hint hint--sm">
                현재 자산은 등록한 ETF 평가금 합계로, 수익률은 보유 ETF 기대 수익률을 비중대로 평균 내서 자동 계산해요.
              </p>
              <div className="callout">
                {months === null ? (
                  <>지금 조건으로는 60년 안에 목표에 닿기 어려워요. 월 투자금이나 목표를 조정해 보세요.</>
                ) : months === 0 ? (
                  <>이미 목표 금액을 넘었어요!</>
                ) : (
                  <>
                    연 {rate.toFixed(1)}%{rateFromEtf ? '' : '(ETF 등록 전 기본 가정)'}로 약 <b>{duration(months)}</b> 뒤,{' '}
                    <b>{age + Math.ceil(months / 12)}세</b>쯤 목표에 도달해요.
                  </>
                )}
              </div>
            </>
          )}
          <button type="submit" className="btn btn--primary btn--xl" disabled={!valid}>
            {isLast ? (initial ? '저장하기' : `${MASCOT_NAME}와 시작하기`) : '다음'}
          </button>
        </div>
      </form>
    </div>
  )
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="summary__row">
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        <button type="button" className="link" onClick={onEdit}>
          수정
        </button>
      </dd>
    </div>
  )
}
