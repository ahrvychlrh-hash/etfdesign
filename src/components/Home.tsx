import { useMemo } from 'react'
import type { Holding, Profile } from '../lib/types'
import type { Plan } from '../lib/plan'
import { colorMap } from '../lib/plan'
import { character, ICONS, withWa } from '../lib/characters'
import { Mascot } from './Mascot'
import { holdingValue, project, requiredMonthly } from '../lib/finance'
import { duration, pct, wonShort } from '../lib/format'
import { primaryLabel, secondaryLabel } from '../lib/presets'
import { ProjectionChart } from './ProjectionChart'
import { Section, Toggle, type Tab } from './ui'

interface Props {
  profile: Profile
  holdings: Holding[]
  plan: Plan
  onTab: (t: Tab) => void
  onAdd: () => void
  onReinvest: (v: boolean) => void
}

export function Home({ profile, holdings, plan, onTab, onAdd, onReinvest }: Props) {
  const years = Math.min(Math.max(plan.months === null ? 30 : Math.ceil(plan.months / 12) + 3, 10), 60)
  const points = useMemo(
    () => project(plan.total, profile.monthly, plan.rate, profile.age, years),
    [plan.total, profile.monthly, plan.rate, profile.age, years],
  )
  const colors = colorMap(holdings)
  const top = [...holdings].sort((a, b) => holdingValue(b) - holdingValue(a)).slice(0, 3)
  const by60 = requiredMonthly(plan.total, plan.rate, profile.target, Math.max((60 - profile.age) * 12, 1))

  const tip =
    plan.months === 0
      ? '목표 달성! 정말 대단해요'
      : plan.months === null
        ? '월 투자금을 조금 늘려볼까요?'
        : `이대로면 ${plan.reachAge}세에\n목표 달성이에요!`

  return (
    <>
      <header className="hero">
        <div className="hero__top">
          <span className="logo">ETF 모아</span>
          <button className="pill-btn" onClick={() => onTab('goal')}>
            목표 {wonShort(profile.target)}
          </button>
        </div>
        <p className="hero__hello">{withWa(character(profile.character).name)} 함께 차곡차곡</p>
        <h1 className="hero__title">
          총 자산 <b>{wonShort(plan.total)}</b>
        </h1>
        <div className="hero__progress">
          <div className="meter meter--on-blue">
            <div className="meter__fill" style={{ width: `${plan.progress * 100}%` }} />
          </div>
          <span>목표의 {(plan.progress * 100).toFixed(1)}%</span>
        </div>
        <div className="hero__stage">
          <p className="bubble bubble--side">{tip}</p>
          <Mascot id={profile.character} className="hero__mascot" />
          <img className="hero__spark" src={ICONS.sparkles} alt="" />
        </div>
      </header>

      <div className="float-row">
        <button className="card card--btn quick" onClick={() => onTab('holdings')}>
          <img src={ICONS.barChart} alt="" className="icon3d" />
          <span className="quick__text">
            <span className="muted">보유 ETF</span>
            <b>
              {holdings.length}개 · {wonShort(plan.etf.value)}
            </b>
          </span>
          <span className="chev">›</span>
        </button>
        <button className="card card--btn quick quick--square" onClick={onAdd}>
          <img src={ICONS.search} alt="" className="icon3d" />
          <b>ETF 추가</b>
        </button>
      </div>

      <div className="card card--soft reinvest">
        <img src={ICONS.coin} alt="" className="icon3d icon3d--sm" />
        <div className="reinvest__text">
          <b>배당금 재투자</b>
          <span className="muted">
            {plan.etfRate == null
              ? '켜면 받은 배당금을 다시 투자해 복리로 굴려요'
              : profile.reinvest
                ? `재투자 중 · 기대 수익률 연 ${plan.etfRate.toFixed(1)}%`
                : `켜면 연 ${plan.etfRate.toFixed(1)}% → ${plan.altRate?.toFixed(1)}%`}
          </span>
        </div>
        <Toggle on={profile.reinvest} onChange={onReinvest} label="배당금 재투자" />
      </div>

      <Section title="한눈에 보기">
        <div className="info-grid">
          <InfoCard
            tone="navy"
            kicker="목표까지 얼마나?"
            title={plan.months === null ? '60년+' : plan.months === 0 ? '달성!' : duration(plan.months)}
            sub={plan.reachAge ? `${plan.reachAge}세 예상` : '조건 조정 필요'}
            icon={ICONS.calendar}
          />
          <InfoCard
            tone="blue"
            kicker={plan.etfRate == null ? 'ETF 등록 전 기본 가정' : '보유 ETF 비중 평균'}
            title={`연 ${plan.rate.toFixed(1)}%`}
            sub={plan.etfRate == null ? "기대 수익률" : profile.reinvest ? "배당 재투자 포함" : "가격 상승분만"}
            icon={ICONS.chart}
          />
          <InfoCard
            tone="violet"
            kicker={`연 ${wonShort(plan.dividend)} (세전)`}
            title={wonShort(plan.dividend / 12)}
            sub="월 평균 배당금"
            icon={ICONS.moneyBag}
          />
          <InfoCard
            tone="slate"
            kicker="앞으로 모을 돈"
            title={wonShort(Math.max(profile.target - plan.total, 0))}
            sub="남은 금액"
            icon={ICONS.bullseye}
          />
        </div>
      </Section>

      <Section title="자산 성장 예측">
        <div className="card">
          <p className="card__note">
            매달 {wonShort(profile.monthly)} · 연 {plan.rate.toFixed(1)}% 가정
          </p>
          <ProjectionChart points={points} target={profile.target} />
          {profile.age < 60 && by60 > profile.monthly && (
            <p className="hint hint--sm">
              60세까지 이루려면 매달 약 <b>{wonShort(by60)}</b>이 필요해요.
            </p>
          )}
        </div>
      </Section>

      <Section
        title="내 ETF"
        action={
          holdings.length > 0 && (
            <button className="link" onClick={() => onTab('holdings')}>
              전체보기 ›
            </button>
          )
        }
      >
        {holdings.length === 0 ? (
          <button className="card card--btn empty" onClick={onAdd}>
            <img src={ICONS.seedling} alt="" className="icon3d" />
            <b>첫 ETF를 등록해 보세요</b>
            <span className="muted">검색하면 현재가가 자동으로 들어가요</span>
          </button>
        ) : (
          <div className="card list">
            {top.map((h) => {
              const v = holdingValue(h)
              const r = h.invested ? ((v - h.invested) / h.invested) * 100 : 0
              return (
                <div className="list__row" key={h.id}>
                  <span className="badge" style={{ background: colors.get(h.id) }}>
                    {primaryLabel(h).slice(0, 1)}
                  </span>
                  <span className="list__main">
                    <b>{primaryLabel(h)}</b>
                    <span className="muted">{secondaryLabel(h)}</span>
                  </span>
                  <span className="list__num">
                    <b>{wonShort(v)}</b>
                    <span className={r > 0 ? 'tone-up' : r < 0 ? 'tone-down' : 'muted'}>{pct(r)}</span>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}

function InfoCard(props: {
  tone: 'navy' | 'slate' | 'blue' | 'violet'
  kicker: string
  title: string
  sub: string
  icon: string
}) {
  return (
    <div className={`info info--${props.tone}`}>
      <span className="info__kicker">{props.kicker}</span>
      <b className="info__title">{props.title}</b>
      <span className="info__sub">{props.sub}</span>
      <img src={props.icon} alt="" className="info__icon" />
    </div>
  )
}
