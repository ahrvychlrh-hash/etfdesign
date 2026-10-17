import type { Profile } from '../lib/types'
import type { Plan } from '../lib/plan'
import { ICONS } from '../lib/characters'
import { Mascot } from './Mascot'
import { duration, wonShort } from '../lib/format'
import { ConfirmButton } from './ui'

interface Props {
  profile: Profile
  plan: Plan
  onEdit: () => void
  onReset: () => void
}

export function Goal({ profile, plan, onEdit, onReset }: Props) {
  return (
    <>
      <header className="hero hero--goal">
        <div className="hero__top">
          <span className="logo">내 목표</span>
          <button className="pill-btn" onClick={onEdit}>
            수정하기
          </button>
        </div>
        <Mascot className="mascot--goal" />
        <h1 className="hero__title hero__title--center">
          <b>{wonShort(profile.target)}</b> 모으기
        </h1>
        <p className="hero__hello hero__hello--center">
          {plan.months === null
            ? '지금 조건으론 60년 넘게 걸려요'
            : plan.months === 0
              ? '이미 목표를 달성했어요!'
              : `${duration(plan.months)} 뒤 · ${plan.reachAge}세 달성 예상`}
        </p>
      </header>

      <div className="grid2 float-row--grid">
        <Tile icon={ICONS.hourglass} label="나이" value={`${profile.age}세`} />
        <Tile icon={ICONS.bank} label={plan.realEstate > 0 ? '총자산 (부동산 포함)' : '현재 자산 (투자 합계)'} value={wonShort(plan.total)} />
        <Tile icon={ICONS.rocket} label="월 투자금" value={wonShort(profile.monthly)} />
        <Tile
          icon={ICONS.chart}
          label={plan.etfRate == null ? '목표 수익률 (기본 가정)' : '목표 수익률 (ETF 평균)'}
          value={`연 ${plan.rate.toFixed(1)}%`}
        />
      </div>

      <section className="section">
        <div className="card card--plain">
          <p className="footnote">
            입력한 정보는 이 기기의 브라우저에만 저장돼요. 국내 ETF 시세는 네이버 금융, 과거 성과·배당·해외 시세는 Yahoo
            Finance 기준이며 실제와 차이가 있을 수 있어요. 아이콘: Microsoft Fluent Emoji.
          </p>
          <ConfirmButton
            className="link link--danger"
            label="데이터 초기화"
            question="모든 데이터를 지울까요?"
            confirmLabel="초기화"
            onConfirm={onReset}
          />
        </div>
      </section>
    </>
  )
}

function Tile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="card tile">
      <img src={icon} alt="" className="icon3d icon3d--sm" />
      <span className="muted">{label}</span>
      <b>{value}</b>
    </div>
  )
}
