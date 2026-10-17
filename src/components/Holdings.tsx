import type { Account, Holding, Profile } from '../lib/types'
import type { Plan } from '../lib/plan'
import { colorMap } from '../lib/plan'
import { ICONS } from '../lib/characters'
import {
  avgPrice,
  DIVIDEND_TAX,
  expectedReturn,
  holdingDividend,
  holdingValue,
  monthlyDividends,
  portfolioReturn,
  portfolioSummary,
} from '../lib/finance'
import { pct, won, wonShort } from '../lib/format'
import { displayTicker } from '../lib/presets'
import { Section, Toggle } from './ui'

interface Props {
  profile: Profile
  accounts: Account[]
  holdings: Holding[]
  plan: Plan
  refreshing: boolean
  onAdd: (accountId?: string) => void
  onEdit: (h: Holding) => void
  onRefresh: () => void
  onReinvest: (v: boolean) => void
  onManageAccounts: () => void
}

export function Holdings(props: Props) {
  const { profile, accounts, holdings, plan, refreshing, onAdd, onEdit, onRefresh, onReinvest, onManageAccounts } = props
  const colors = colorMap(holdings)
  const { etf } = plan

  return (
    <>
      <header className="hero hero--compact">
        <div className="hero__top">
          <span className="logo">보유 ETF</span>
          {holdings.length > 0 && (
            <button className="pill-btn" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? '불러오는 중…' : '시세 새로고침'}
            </button>
          )}
        </div>
        <p className="hero__hello">총 평가금</p>
        <h1 className="hero__title">
          <b>{won(etf.value)}</b>
        </h1>
        <p className="hero__meta">
          투자금 {wonShort(etf.cost)} ·{' '}
          <span className="on-blue-chip">
            {etf.gain >= 0 ? '+' : ''}
            {wonShort(etf.gain)} ({pct(etf.gainPct)})
          </span>
        </p>
        <img className="hero__corner" src={ICONS.chart} alt="" />
      </header>

      <div className="card card--soft reinvest float-row--single">
        <img src={ICONS.coin} alt="" className="icon3d icon3d--sm" />
        <div className="reinvest__text">
          <b>배당금 재투자 {profile.reinvest ? 'ON' : 'OFF'}</b>
          <span className="muted">
            {plan.etfRate == null
              ? 'ETF를 등록하면 기대 수익률을 계산해요'
              : `내 ETF 기대 수익률 연 ${plan.etfRate.toFixed(1)}%`}
          </span>
        </div>
        <Toggle on={profile.reinvest} onChange={onReinvest} label="배당금 재투자" />
      </div>

      {holdings.length > 0 && <Dividends holdings={holdings} colors={colors} />}

      <Section
        title="계좌별 ETF"
        action={
          <button className="link" onClick={onManageAccounts}>
            계좌 관리
          </button>
        }
      >
        <div className="stack stack--flush">
          {accounts.map((acc) => {
            const list = holdings.filter((h) => h.accountId === acc.id).sort((a, b) => holdingValue(b) - holdingValue(a))
            const sum = portfolioSummary(list)
            const rate = portfolioReturn(list, profile.reinvest)
            return (
              <div key={acc.id} className="account">
                <div className="account__head">
                  <img src={ICONS.briefcase} alt="" className="icon3d icon3d--xs" />
                  <span className="list__main">
                    <b>
                      {acc.name} {acc.kind !== '일반' && <span className="tag tag--blue tag--xs">{acc.kind}</span>}
                    </b>
                    <span className="muted">
                      {list.length}개 · 평가 {wonShort(sum.value)}
                      {rate != null && ` · 기대 연 ${rate.toFixed(1)}%`}
                    </span>
                  </span>
                  <span className="list__num">
                    <span className={sum.gain > 0 ? 'tone-up' : sum.gain < 0 ? 'tone-down' : 'muted'}>
                      {list.length ? pct(sum.gainPct) : ''}
                    </span>
                  </span>
                </div>
                {list.map((h) => (
                  <HoldingCard key={h.id} h={h} color={colors.get(h.id)} reinvest={profile.reinvest} total={etf.value} onEdit={onEdit} />
                ))}
                <button className="account__add" onClick={() => onAdd(acc.id)}>
                  + 이 계좌에 ETF 추가
                </button>
              </div>
            )
          })}

          <p className="footnote">
            기대 수익률은 자산군별 30년 장기 평균을 기준으로, 각 ETF의 실제 성과를 상장 기간만큼만(최대 30년) 반영해요.
            30년이 안 된 ETF는 실제 성과를 장기 평균 ±4%p 안에서만 반영해 단기 급등락을 걸러요. 재투자 OFF면 배당수익률만큼
            빼고 계산해요. 과거 성과가 미래 수익을 보장하지 않아요.
          </p>
        </div>
      </Section>
    </>
  )
}

function HoldingCard({
  h,
  color,
  reinvest,
  total,
  onEdit,
}: {
  h: Holding
  color?: string
  reinvest: boolean
  total: number
  onEdit: (h: Holding) => void
}) {
  const v = holdingValue(h)
  const r = h.invested ? ((v - h.invested) / h.invested) * 100 : 0
  const div = holdingDividend(h)
  return (
    <button className="card card--btn holding" onClick={() => onEdit(h)}>
      <div className="holding__top">
        <span className="badge" style={{ background: color }}>
          {h.name.slice(0, 1)}
        </span>
        <span className="list__main">
          <b>{h.name}</b>
          <span className="muted">
            {displayTicker(h.symbol)} · {h.quantity.toLocaleString('ko-KR')}주 · 평균 {won(avgPrice(h))}
          </span>
        </span>
        <span className="list__num">
          <b>{wonShort(v)}</b>
          <span className={r > 0 ? 'tone-up' : r < 0 ? 'tone-down' : 'muted'}>{pct(r)}</span>
        </span>
      </div>
      <div className="tags">
        <span className="tag tag--blue">기대 연 {expectedReturn(h, reinvest).toFixed(1)}%</span>
        <span className="tag">배당 {div > 0 ? `연 ${wonShort(div)}` : '없음'}</span>
        <span className="tag">비중 {total ? ((v / total) * 100).toFixed(0) : 0}%</span>
        {h.priceMode === 'manual' && <span className="tag tag--warn">평가금 직접입력</span>}
      </div>
    </button>
  )
}

function Dividends({ holdings, colors }: { holdings: Holding[]; colors: Map<string, string> }) {
  const year = holdings.reduce((s, h) => s + holdingDividend(h), 0)
  const months = monthlyDividends(holdings)
  const max = Math.max(...months, 1)
  const payers = holdings.filter((h) => holdingDividend(h) > 0).sort((a, b) => holdingDividend(b) - holdingDividend(a))

  return (
    <Section title="내 배당금">
      <div className="card div">
        <div className="div__sum">
          <div>
            <span className="muted">연 예상 배당금 (세전)</span>
            <b className="div__big">{won(year)}</b>
          </div>
          <img src={ICONS.moneyBag} alt="" className="icon3d" />
        </div>
        <div className="div__grid">
          <span>
            <span className="muted">세후 (15.4%)</span>
            <b>{won(Math.round((year * (1 - DIVIDEND_TAX)) / 100) * 100)}</b>
          </span>
          <span>
            <span className="muted">월 평균</span>
            <b>{won(Math.round(year / 12 / 100) * 100)}</b>
          </span>
          <span>
            <span className="muted">세후 월 평균</span>
            <b>{won(Math.round((year * (1 - DIVIDEND_TAX)) / 12 / 100) * 100)}</b>
          </span>
        </div>

        {year > 0 ? (
          <>
            <div className="div__months" role="img" aria-label="월별 예상 배당금">
              {months.map((m, i) => (
                <div key={i} className="div__month" title={`${i + 1}월 ${won(m)}`}>
                  <span className="div__val">{m > 0 ? wonShort(m).replace('원', '') : ''}</span>
                  <span className="div__bar" style={{ height: m > 0 ? `${Math.max((m / max) * 100, 4)}%` : 0 }} />
                  <span className="div__m">{i + 1}</span>
                </div>
              ))}
            </div>
            <ul className="div__list">
              {payers.map((h) => (
                <li key={h.id}>
                  <i className="dot-sm" style={{ background: colors.get(h.id) }} />
                  <span className="div__name">{h.name}</span>
                  <span className="muted">{h.stats?.payMonths.length ? `${h.stats.payMonths.join('·')}월` : ''}</span>
                  <b>{wonShort(holdingDividend(h))}</b>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="hint hint--sm">보유 ETF 중 최근 12개월 동안 배당을 준 종목이 없어요. (TR·성장형 ETF는 배당을 자동 재투자해요)</p>
        )}
        <p className="hint hint--sm">최근 12개월 실제 지급액 × 보유 수량 기준이에요. ISA·연금 계좌는 세금이 다르게 적용돼요.</p>
      </div>
    </Section>
  )
}
