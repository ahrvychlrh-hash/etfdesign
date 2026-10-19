import { useState } from 'react'
import { isReserve, type Account, type CryptoAsset, type Holding, type Profile, type RealEstate, type Reinvest } from '../lib/types'
import { RealEstateSection } from './RealEstateSection'
import { CryptoSection } from './CryptoSection'
import { realPrincipal } from '../lib/history'
import type { Plan } from '../lib/plan'
import { colorMap } from '../lib/plan'
import { ACCOUNT_ICONS, ICONS } from '../lib/characters'
import {
  avgPrice,
  dayChange,
  dividendTaxNote,
  dividendTaxRate,
  expectedReturn,
  holdingDividend,
  holdingValue,
  monthlyDividends,
  portfolioReturn,
  portfolioSummary,
} from '../lib/finance'
import { pct, won, wonShort } from '../lib/format'
import { primaryLabel, secondaryLabel, unitOf } from '../lib/presets'
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
  reinvests: Reinvest[]
  /** 비상금 계좌를 뺀 투자 자산 */
  investHoldings: Holding[]
  realEstates: RealEstate[]
  onSaveRealEstate: (r: RealEstate) => void
  onDeleteRealEstate: (id: string) => void
  cryptos: CryptoAsset[]
  onSaveCrypto: (c: CryptoAsset) => void
  onDeleteCrypto: (id: string) => void
}

export function Holdings(props: Props) {
  const { profile, accounts, holdings, plan, refreshing, onAdd, onEdit, onRefresh, onReinvest, onManageAccounts } = props
  const colors = colorMap(holdings)
  const { etf } = plan
  // 투자금 = 실제 원금 (재투자한 돈은 내 원금이 아니므로 빼고 수익 계산)
  const principal = realPrincipal(props.investHoldings, props.reinvests)
  const gain = etf.value - principal
  // 계좌별 ETF 목록은 접어두고 펼치기를 눌러야 보여줌
  const [opened, setOpened] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <>
      <header className="hero hero--compact">
        <div className="hero__top">
          <span className="logo">보유 ETF</span>
          {(holdings.length > 0 || props.cryptos.length > 0) && (
            <button className="pill-btn" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? '불러오는 중…' : '시세 새로고침'}
            </button>
          )}
        </div>
        <p className="hero__hello">{plan.reserve > 0 ? '투자 평가금' : '총 평가금'}</p>
        <h1 className="hero__title">
          <b>{won(etf.value)}</b>
        </h1>
        <p className="hero__meta">
          투자금 {wonShort(principal)} ·{' '}
          <span className="on-blue-chip">
            {gain >= 0 ? '+' : ''}
            {wonShort(gain)} ({principal > 0 ? pct((gain / principal) * 100) : '—'})
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

      <AccountShare accounts={accounts} holdings={holdings} />

      {holdings.length > 0 && <Dividends holdings={holdings} accounts={accounts} colors={colors} />}

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
            // 오늘(최근 거래일) 전일 종가 대비 등락
            const today = dayChange(list)
            // 빈 계좌는 접을 것이 없으니 추가 버튼만 바로 보여줌
            const expandable = list.length > 0 || isReserve(acc)
            const isOpen = !expandable || opened.has(acc.id)
            return (
              <div key={acc.id} className="account">
                <button
                  className="account__head account__head--btn"
                  onClick={() => toggle(acc.id)}
                  aria-expanded={isOpen}
                  disabled={!expandable}
                >
                  <img src={ACCOUNT_ICONS[acc.kind] ?? ICONS.briefcase} alt="" className="icon3d icon3d--xs" />
                  <span className="list__main">
                    <b>
                      {acc.name}{' '}
                      {isReserve(acc) ? (
                        <span className="tag tag--warn tag--xs">비상금 · 수익률 제외</span>
                      ) : (
                        acc.kind !== '일반' && <span className="tag tag--blue tag--xs">{acc.kind}</span>
                      )}
                    </b>
                    <span className="muted">
                      {list.length}개 · 평가 {wonShort(sum.value)}
                      {rate != null && ` · 기대 연 ${rate.toFixed(1)}%`}
                    </span>
                  </span>
                  <span className="list__num account__rates">
                    {list.length > 0 && (
                      <span className="rate-total">
                        <span className="muted">총 </span>
                        <b className={tone(sum.gain)}>{pct(sum.gainPct)}</b>
                      </span>
                    )}
                    {today && (
                      <span className="rate-today">
                        <span className="muted">오늘 </span>
                        <span className={tone(today.amount)}>{pct(today.pct, 2)}</span>
                      </span>
                    )}
                  </span>
                  {expandable && <span className="account__chev">{isOpen ? '▴' : '▾'}</span>}
                </button>
                {isOpen && isReserve(acc) && (
                  <button className="card card--btn cash-row" onClick={onManageAccounts}>
                    <img src={ICONS.banknote} alt="" className="icon3d icon3d--xs" />
                    <span className="list__main">
                      <b>현금</b>
                      <span className="muted">계좌 관리에서 잔액을 바꿀 수 있어요</span>
                    </span>
                    <b>{won(acc.cash ?? 0)}</b>
                  </button>
                )}
                {isOpen &&
                  list.map((h) => (
                    <HoldingCard
                      key={h.id}
                      h={h}
                      color={colors.get(h.id)}
                      reinvest={profile.reinvest}
                      total={isReserve(acc) ? 0 : etf.value}
                      onEdit={onEdit}
                    />
                  ))}
                {isOpen && (
                  <button className="account__add" onClick={() => onAdd(acc.id)}>
                    + 이 계좌에 ETF 추가
                  </button>
                )}
                {expandable && (
                  <button className="account__more" onClick={() => toggle(acc.id)} aria-expanded={isOpen}>
                    {isOpen ? '접기 ▴' : `${isReserve(acc) ? '현금·' : ''}ETF ${list.length}개 펼치기 ▾`}
                  </button>
                )}
              </div>
            )
          })}

          <p className="footnote">
            기대 수익률은 30년 이상 된 ETF면 그 ETF의 30년 평균을, 그보다 짧으면 기초지수(예: 코스닥 액티브 → 코스닥 지수,
            S&P500 ETF → S&P500)의 장기 평균을 써요. 재투자 OFF면 배당수익률만큼 빼고 계산해요. 과거 성과가 미래 수익을
            보장하지 않아요.
          </p>
        </div>
      </Section>

      <CryptoSection items={props.cryptos} onSave={props.onSaveCrypto} onDelete={props.onDeleteCrypto} />

      <RealEstateSection items={props.realEstates} onSave={props.onSaveRealEstate} onDelete={props.onDeleteRealEstate} />
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
  const today = dayChange([h])
  return (
    <button className="card card--btn holding" onClick={() => onEdit(h)}>
      <div className="holding__top">
        <span className="badge" style={{ background: color }}>
          {primaryLabel(h).slice(0, 1)}
        </span>
        <span className="list__main">
          <b>{primaryLabel(h)}</b>
          <span className="muted">
            {secondaryLabel(h)} · {h.quantity.toLocaleString('ko-KR')}{unitOf(h.symbol)} · 평균 {won(avgPrice(h))}
          </span>
        </span>
        <span className="list__num">
          <b>{wonShort(v)}</b>
          <span className="rate-total">
            <span className="muted">총 </span>
            <b className={tone(r)}>{pct(r)}</b>
          </span>
          {today && (
            <span className="rate-today">
              <span className="muted">오늘 </span>
              <span className={tone(today.amount)}>{pct(today.pct, 2)}</span>
            </span>
          )}
        </span>
      </div>
      <div className="tags">
        <span className="tag tag--blue">기대 연 {expectedReturn(h, reinvest).toFixed(1)}%</span>
        <span className="tag">배당 {div > 0 ? `연 ${wonShort(div)}` : '없음'}</span>
        {total ? (
          <span className="tag">비중 {((v / total) * 100).toFixed(0)}%</span>
        ) : (
          <span className="tag tag--warn">비상금 · 수익률 제외</span>
        )}
        {h.priceMode === 'manual' && <span className="tag tag--warn">평가금 직접입력</span>}
      </div>
    </button>
  )
}

function Dividends({ holdings, accounts, colors }: { holdings: Holding[]; accounts: Account[]; colors: Map<string, string> }) {
  // 종목별 배당 목록은 길어서 '자세히 보기'를 눌러야 보여줌
  const [open, setOpen] = useState(false)
  const kindOf = new Map(accounts.map((a) => [a.id, a.kind]))
  // 세후는 계좌 종류별 세율로 (ISA·연금은 지금 떼는 세금 없음)
  const afterTax = (h: Holding) => holdingDividend(h) * (1 - dividendTaxRate(kindOf.get(h.accountId) ?? '일반'))
  const year = holdings.reduce((s, h) => s + holdingDividend(h), 0)
  const yearAfter = holdings.reduce((s, h) => s + afterTax(h), 0)
  // 계좌별 배당
  const byAccount = accounts
    .map((a) => {
      const list = holdings.filter((h) => h.accountId === a.id)
      return {
        account: a,
        pre: list.reduce((s, h) => s + holdingDividend(h), 0),
        post: list.reduce((s, h) => s + afterTax(h), 0),
      }
    })
    .filter((r) => r.pre > 0)
    .sort((x, y) => y.pre - x.pre)
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
            <span className="muted">세후 (계좌별)</span>
            <b>{won(Math.round(yearAfter / 100) * 100)}</b>
          </span>
          <span>
            <span className="muted">월 평균</span>
            <b>{won(Math.round(year / 12 / 100) * 100)}</b>
          </span>
          <span>
            <span className="muted">세후 월 평균</span>
            <b>{won(Math.round(yearAfter / 12 / 100) * 100)}</b>
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
            {byAccount.length > 0 && (
              <div className="div-acc">
                <span className="div-acc__title">계좌별 배당금 (연)</span>
                <ul>
                  {byAccount.map(({ account, pre, post }) => (
                    <li key={account.id}>
                      <img src={ACCOUNT_ICONS[account.kind] ?? ICONS.briefcase} alt="" className="icon3d icon3d--xs" />
                      <span className="list__main">
                        <b>{account.name}</b>
                        <span className="muted">{dividendTaxNote(account.kind)}</span>
                      </span>
                      <span className="list__num">
                        <b>{wonShort(pre)}</b>
                        <span className="muted">
                          세후 {wonShort(post)} · 월 {wonShort(post / 12)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {open && (
              <ul className="div__list">
                {payers.map((h) => (
                  <li key={h.id}>
                    <i className="dot-sm" style={{ background: colors.get(h.id) }} />
                    <span className="div__name">{primaryLabel(h)}</span>
                    <span className="muted">{payLabel(h.stats?.payMonths ?? [])}</span>
                    <b>{wonShort(holdingDividend(h))}</b>
                  </li>
                ))}
              </ul>
            )}
            <button className="share__more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? '접기 ▴' : `종목별 배당 ${payers.length}개 자세히 보기 ▾`}
            </button>
          </>
        ) : (
          <p className="hint hint--sm">보유 ETF 중 최근 12개월 동안 배당을 준 종목이 없어요. (TR·성장형 ETF는 배당을 자동 재투자해요)</p>
        )}
        <p className="hint hint--sm">
          최근 12개월 실제 지급액 × 보유 수량 기준이에요. ISA는 연 200만원(일반형)까지 비과세로, 연금저축·IRP는 지금은 세금을 떼지
          않는 것으로 계산했어요.
        </p>
      </div>
    </Section>
  )
}

/** 지급 월 표시 — 거의 매달 주면 '매월' */
function payLabel(months: number[]) {
  if (!months.length) return ''
  if (months.length >= 10) return '매월'
  return `${months.join('·')}월`
}

/** 계좌별 색 — 계좌 순서로 고정 */
const ACCOUNT_COLORS = ['#3d5afe', '#ff7a45', '#1baf7a', '#f5a400', '#7b5cff', '#e87ba4', '#008300', '#e34948']

function AccountShare({ accounts, holdings }: { accounts: Account[]; holdings: Holding[] }) {
  // 계좌별 = 보유 ETF 평가금 + 현금(비상금 계좌)
  const values = accounts.map(
    (a) => holdings.filter((h) => h.accountId === a.id).reduce((s, h) => s + holdingValue(h), 0) + (a.cash ?? 0),
  )
  const total = values.reduce((s, v) => s + v, 0)
  if (total <= 0) return null
  const rows = accounts
    .map((a, i) => ({ ...a, value: values[i], pct: (values[i] / total) * 100, color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }))
    .filter((r) => r.value > 0)

  return (
    <Section title="계좌별 자산 비중">
      <div className="card">
        <div className="acc-bar" role="img" aria-label={rows.map((r) => `${r.name} ${r.pct.toFixed(1)}%`).join(', ')}>
          {rows.map((r) => (
            <span key={r.id} style={{ flexGrow: r.value, background: r.color }} title={`${r.name} ${r.pct.toFixed(1)}%`}>
              {r.pct >= 12 && <b>{r.pct.toFixed(0)}%</b>}
            </span>
          ))}
        </div>
        <ul className="acc-legend">
          {rows.map((r) => (
            <li key={r.id}>
              <i className="dot-sm" style={{ background: r.color }} />
              <span className="acc-legend__name">
                {r.name}
                {r.kind !== '일반' && <span className="tag tag--blue tag--xs">{r.kind}</span>}
              </span>
              <span className="muted">{wonShort(r.value)}</span>
              <b>{r.pct.toFixed(1)}%</b>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

/** 수익(+)은 빨강, 손실(−)은 파랑 */
function tone(v: number) {
  return v > 0 ? 'tone-up' : v < 0 ? 'tone-down' : 'muted'
}
