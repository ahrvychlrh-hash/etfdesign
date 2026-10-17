import { useState, type FormEvent } from 'react'
import type { Profile } from '../lib/types'
import { character, withWa, type CharacterId } from '../lib/characters'
import { CharacterPicker, Mascot } from './Mascot'
import { MoneyInput } from './MoneyInput'
import { monthsToTarget } from '../lib/finance'
import { duration, wonShort } from '../lib/format'

interface Props {
  initial?: Profile | null
  onDone: (p: Profile) => void
  onCancel?: () => void
}

const BIG = [
  { label: '+100만', amount: 1_000_000 },
  { label: '+1,000만', amount: 10_000_000 },
  { label: '+1억', amount: 100_000_000 },
]
const SMALL = [
  { label: '+10만', amount: 100_000 },
  { label: '+50만', amount: 500_000 },
  { label: '+100만', amount: 1_000_000 },
]

const STEPS = ['나이', '현재 자산', '목표 금액', '월 투자금', '확인'] as const

export function Onboarding({ initial, onDone, onCancel }: Props) {
  const [step, setStep] = useState(initial ? STEPS.length - 1 : 0)
  const [age, setAge] = useState(initial?.age ?? 0)
  const [cash, setCash] = useState(initial?.cash ?? 0)
  const [target, setTarget] = useState(initial?.target ?? 0)
  const [monthly, setMonthly] = useState(initial?.monthly ?? 0)
  const [char, setChar] = useState<CharacterId>(initial?.character ?? 'star')
  // 소수점 입력 중("7.")에도 점이 사라지지 않도록 문자열로 보관
  const [returnText, setReturnText] = useState(String(initial?.annualReturn ?? 7))
  const annualReturn = Number(returnText) || 0

  const valid = [age > 0 && age < 120, true, target > 0, monthly >= 0, annualReturn <= 30][step]
  const isLast = step === STEPS.length - 1
  const months = monthsToTarget(cash, monthly, annualReturn, target)
  const me = character(char)

  const bubble = [
    `안녕하세요! 저는 ${me.name}예요.\n먼저 나이를 알려주세요`,
    '지금 모아둔 자산은\n얼마나 되나요?',
    '얼마를 모으는 게\n목표예요?',
    '매달 얼마씩\n투자할 수 있어요?',
    initial ? '목표를 다시 정리해 볼까요?' : '좋아요! 함께할 친구를\n골라주세요',
  ][step]

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    if (!isLast) return setStep(step + 1)
    onDone({
      age,
      cash,
      target,
      monthly,
      annualReturn,
      reinvest: initial?.reinvest ?? true,
      character: char,
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
            <p className="bubble" key={bubble}>
              {bubble}
            </p>
            <Mascot id={char} className="mascot--onb" />
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
              <label htmlFor="cash" className="q">현재 자산</label>
              <MoneyInput id="cash" value={cash} onChange={setCash} chips={BIG} autoFocus />
              <p className="hint">예금·현금처럼 투자에 쓸 수 있는 돈이에요. 가진 ETF는 시작한 뒤 따로 추가해요.</p>
            </>
          )}
          {step === 2 && (
            <>
              <label htmlFor="target" className="q">목표 금액</label>
              <MoneyInput id="target" value={target} onChange={setTarget} chips={BIG} autoFocus />
            </>
          )}
          {step === 3 && (
            <>
              <label htmlFor="monthly" className="q">월 투자금</label>
              <MoneyInput id="monthly" value={monthly} onChange={setMonthly} chips={SMALL} autoFocus />
              <p className="hint">무리 없이 꾸준히 넣을 수 있는 금액이 좋아요.</p>
            </>
          )}
          {step === 4 && (
            <>
              <CharacterPicker value={char} onChange={setChar} />
              <dl className="summary">
                <SummaryRow label="나이" value={`${age}세`} onEdit={() => setStep(0)} />
                <SummaryRow label="현재 자산" value={wonShort(cash)} onEdit={() => setStep(1)} />
                <SummaryRow label="목표 금액" value={wonShort(target)} onEdit={() => setStep(2)} />
                <SummaryRow label="월 투자금" value={wonShort(monthly)} onEdit={() => setStep(3)} />
                <div className="summary__row">
                  <dt>
                    <label htmlFor="ret">기본 연 수익률</label>
                  </dt>
                  <dd>
                    <div className="field field--sm">
                      <input
                        id="ret"
                        inputMode="decimal"
                        value={returnText}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.]/g, '')
                          if (/^\d{0,2}(\.\d{0,2})?$/.test(v)) setReturnText(v)
                        }}
                      />
                      <span className="field__suffix">%</span>
                    </div>
                  </dd>
                </div>
              </dl>
              <p className="hint hint--sm">ETF를 등록하면 보유 ETF의 과거 성과로 수익률을 자동 계산해요.</p>
              <div className="callout">
                {months === null ? (
                  <>지금 조건으로는 60년 안에 목표에 닿기 어려워요. 월 투자금이나 목표를 조정해 보세요.</>
                ) : months === 0 ? (
                  <>이미 목표 금액을 넘었어요!</>
                ) : (
                  <>
                    약 <b>{duration(months)}</b> 뒤, <b>{age + Math.ceil(months / 12)}세</b>쯤 목표에 도달해요.
                  </>
                )}
              </div>
            </>
          )}
          <button type="submit" className="btn btn--primary btn--xl" disabled={!valid}>
            {isLast ? (initial ? '저장하기' : `${withWa(me.name)} 시작하기`) : '다음'}
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
