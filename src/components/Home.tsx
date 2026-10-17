import { useMemo } from 'react'
import type { Holding, Profile } from '../lib/types'
import type { Plan } from '../lib/plan'
import { ICONS, MASCOT_NAME, withWa } from '../lib/characters'
import { Mascot } from './Mascot'
import { LogoMark } from './Logo'
import { project, requiredMonthly, withdrawalPlan } from '../lib/finance'
import { duration, wonShort } from '../lib/format'
import { currentQuote } from '../lib/quotes'
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
  // 투자 자산만 불어나고, 부동산은 그대로 더해지는 고정값으로 봄
  const points = useMemo(
    () =>
      project(plan.etf.value, profile.monthly, plan.rate, profile.age, years).map((p) => ({
        ...p,
        value: p.value + plan.fixed,
        contributed: p.contributed + plan.fixed,
      })),
    [plan.etf.value, plan.fixed, profile.monthly, plan.rate, profile.age, years],
  )
  const by60 = requiredMonthly(
    plan.etf.value,
    plan.rate,
    profile.target - plan.fixed,
    Math.max((60 - profile.age) * 12, 1),
  )
  // 6시간마다 바뀌는 장기 투자 명언
  const quote = currentQuote()

  return (
    <>
      <header className="hero">
        <div className="hero__top">
          <span className="logo">
            <LogoMark size={24} /> ETF DESIGN
          </span>
          <button className="pill-btn" onClick={() => onTab('goal')}>
            목표 {wonShort(profile.target)}
          </button>
        </div>
        <p className="hero__hello">{withWa(MASCOT_NAME)} 함께 차곡차곡</p>
        <div className="hero__total">
        {/* 총자산 바로 밑에 목표 진행률 */}
        <div>
          <h1 className="hero__title">
            총 자산 <b>{wonShort(plan.total)}</b>
          </h1>
          <div className="hero__progress hero__progress--tight">
            <div className="meter meter--on-blue">
              <div className="meter__fill" style={{ width: `${plan.progress * 100}%` }} />
            </div>
            <span>목표의 {(plan.progress * 100).toFixed(1)}%</span>
          </div>
        </div>
        <dl className="hero__breakdown">
          {(
            [
              ['투자 자산', plan.etf.value],
              ['비상금', plan.reserve],
              ['부동산', plan.realEstate],
              ['코인', plan.crypto],
            ] as const
          ).map(([label, v]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{wonShort(v)}</dd>
            </div>
          ))}
        </dl>
        </div>
        <div className="hero__stage">
          <figure className="hero__quote">
            <blockquote>{quote.text}</blockquote>
            <figcaption>— {quote.by}</figcaption>
          </figure>
          <Mascot className="hero__mascot" />
        </div>
      </header>

      <div className="float-row">
        <button className="card card--btn quick" onClick={() => onTab('holdings')}>
          <img src={ICONS.barChart} alt="" className="icon3d" />
          <span className="quick__text">
            <span className="muted">투자 자산 (ETF·금)</span>
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
            sub={plan.etfRate == null ? '기대 수익률' : profile.reinvest ? '배당 재투자 포함' : '가격 상승분만'}
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
          <WithdrawCard target={profile.target} rate={plan.rate} />
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

/** 목표 달성 후 4% 룰로 매달 꺼내 쓸 수 있는 돈 */
function WithdrawCard({ target, rate }: { target: number; rate: number }) {
  const w = withdrawalPlan(target, rate)
  const growthPct = w.growth * 100
  return (
    <div className="info info--teal info--wide">
      <span className="info__kicker">목표 달성 후 매달 꺼내 쓸 돈 · 4% 룰</span>
      <b className="info__title">월 {wonShort(w.monthly)}</b>
      {growthPct > 0 ? (
        <span className="info__desc">
          연 {rate.toFixed(1)}% 수익률이 유지되면 해마다 <b>+{growthPct.toFixed(1)}%</b>씩 늘어나요
          <br />
          내년 월 {wonShort(w.nextYearMonthly)} · 10년 뒤 월 {wonShort(w.tenYearMonthly)}
        </span>
      ) : (
        <span className="info__desc">
          수익률이 연 {rate.toFixed(1)}%라 4%씩 꺼내면 자산이 조금씩 줄어들 수 있어요
        </span>
      )}
      <img src={ICONS.banknote} alt="" className="info__icon" />
    </div>
  )
}
