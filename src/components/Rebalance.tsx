import { useMemo, useState } from 'react'
import type { Holding } from '../lib/types'
import { ICONS } from '../lib/characters'
import { positions, rebalance, TOLERANCE, type RebalanceRow } from '../lib/rebalance'
import { judgeCountries, judgeSectors, portfolioExposure, type Level } from '../lib/exposure'
import { colorMap } from '../lib/plan'
import { won, wonShort } from '../lib/format'
import { formatQty, primaryLabel, secondaryLabel, unitOf } from '../lib/presets'
import { MoneyInput } from './MoneyInput'
import { Section, Toggle } from './ui'

interface Props {
  holdings: Holding[]
  targets: Record<string, number>
  onTargets: (t: Record<string, number>) => void
}

export function Rebalance({ holdings, targets, onTargets }: Props) {
  const list = useMemo(() => positions(holdings), [holdings])
  // 기본은 0원: 지금 가진 자산 안에서 사고팔 금액을 보여줌
  const [extra, setExtra] = useState(0)
  const [buyOnly, setBuyOnly] = useState(false)
  // 입력 중인 값("33.")을 그대로 보여주기 위해 문자열로 보관
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const sumTarget = list.reduce((s, p) => s + (targets[p.symbol] ?? 0), 0)
  const hasTargets = sumTarget > 0
  // 추가 투자금이 없으면 '추가 매수로만'은 의미가 없으므로 사고팔기로 계산
  const buyOnlyActive = buyOnly && extra > 0
  const rows = rebalance(list, targets, extra, buyOnlyActive)
  const buyTotal = rows.filter((r) => r.action === 'buy').reduce((s, r) => s + r.amount, 0)
  const sellTotal = rows.filter((r) => r.action === 'sell').reduce((s, r) => s - r.amount, 0)
  const exposure = useMemo(() => portfolioExposure(holdings), [holdings])
  const firstId = new Map(holdings.map((h) => [h.symbol, h.id]))
  const colors = colorMap(holdings)

  function setTarget(symbol: string, text: string) {
    const clean = text.replace(/[^\d.]/g, '')
    if (!/^\d{0,3}(\.\d{0,1})?$/.test(clean)) return
    setDrafts((d) => ({ ...d, [symbol]: clean }))
    onTargets({ ...targets, [symbol]: Math.min(Number(clean) || 0, 100) })
  }
  function clearTargets() {
    setDrafts({})
    onTargets({})
  }

  if (!list.length) {
    return (
      <>
        <Header />
        <div className="stack stack--top">
          <div className="card empty">
            <img src={ICONS.seedling} alt="" className="icon3d" />
            <b>ETF를 먼저 등록해 주세요</b>
            <span className="muted">보유 ETF가 있어야 비중을 계산할 수 있어요</span>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />

      <div className="card float-row--single reb-controls">
        <div className="reb-controls__row">
          <span className="form-item__label">이번에 추가로 넣을 돈 (선택)</span>
          <MoneyInput id="extra" value={extra} onChange={setExtra} />
          <span className="form-item__hint">
            {extra > 0
              ? '추가 투자금까지 합쳐서 목표 비중에 맞춰요.'
              : '비워두면 지금 가진 자산 안에서 얼마를 사고팔지 보여줘요.'}
          </span>
        </div>
        {extra > 0 && (
          <div className="reinvest reinvest--flat">
            <div className="reinvest__text">
              <b>팔지 않고 추가 매수로만 맞추기</b>
              <span className="muted">끄면 많은 종목은 팔고 적은 종목은 사서 정확히 맞춰요</span>
            </div>
            <Toggle on={buyOnly} onChange={setBuyOnly} label="추가 매수로만 맞추기" />
          </div>
        )}
      </div>

      <Section
        title="현재 비중 · 목표 비중"
        action={
          <span className={`sum-badge ${Math.abs(sumTarget - 100) < 0.05 ? 'is-ok' : hasTargets ? 'is-warn' : ''}`}>
            목표 합계 {sumTarget.toFixed(1)}%
          </span>
        }
      >
        <div className="reb-fill">
          <span className="form-item__hint">목표 칸에 원하는 비중(%)을 직접 입력하세요.</span>
          {hasTargets && (
            <button className="chip chip--ghost" onClick={clearTargets}>
              목표 지우기
            </button>
          )}
        </div>
        {hasTargets && Math.abs(sumTarget - 100) >= 0.05 && (
          <p className="alert">목표 합계가 100%가 아니에요. 입력한 비율대로 100%에 맞춰 계산했어요.</p>
        )}

        <div className="card reb-table-wrap">
          <table className="reb-table">
            <thead>
              <tr>
                <th>종목</th>
                <th className="num">현재</th>
                <th className="num">목표</th>
                <th className="num">조정</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <td>
                    <div className="reb-name">
                      <i className="dot-sm" style={{ background: colors.get(firstId.get(r.symbol) ?? '') }} />
                      <span className="list__main">
                        <b>{primaryLabel(r)}</b>
                        <span className="muted">
                          {secondaryLabel(r)} · {wonShort(r.value)}
                        </span>
                      </span>
                    </div>
                    <div className="reb-bars" aria-hidden>
                      <span className="reb-bars__cur" style={{ width: `${Math.min(r.current, 100)}%` }} />
                      {hasTargets && <span className="reb-bars__tgt" style={{ left: `${Math.min(r.target, 100)}%` }} />}
                    </div>
                  </td>
                  <td className="num">
                    <b>{r.current.toFixed(1)}%</b>
                  </td>
                  <td className="num">
                    <div className="field field--pct">
                      <input
                        inputMode="decimal"
                        aria-label={`${primaryLabel(r)} 목표 비중`}
                        placeholder="0"
                        value={drafts[r.symbol] ?? (targets[r.symbol] ? String(targets[r.symbol]) : '')}
                        onChange={(e) => setTarget(r.symbol, e.target.value)}
                      />
                      <span className="field__suffix">%</span>
                    </div>
                  </td>
                  <td className="num">{hasTargets ? <Action r={r} /> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasTargets && (
          <div className="reb-sum">
            <span>
              <span className="muted">매수 합계</span>
              <b className="tone-up">{won(buyTotal)}</b>
            </span>
            <span>
              <span className="muted">매도 합계</span>
              <b className="tone-down">{won(sellTotal)}</b>
            </span>
          </div>
        )}
        <p className="footnote">
          금액은 천원 단위로 보여줘요. 목표와 ±{TOLERANCE}%p 이내인 종목은 연하게 표시했어요(꼭 안 맞춰도 괜찮아요). 같은
          ETF가 여러 계좌에 있으면 합쳐서 계산하고, 주식 수는 현재가 기준 대략치예요.
        </p>
      </Section>

      <Section title="자산군 비중">
        <ShareCard items={exposure.asset} />
      </Section>

      <Section title="나라별 비중">
        <ShareCard
          items={judgeCountries(exposure.country).map((c) => ({ ...c, hint: '적정 ' + c.range[0] + '~' + c.range[1] + '%' }))}
        />
      </Section>

      <Section title="섹터별 비중 (주식 부분)">
        <ShareCard
          items={judgeSectors(exposure.sector).map((c) => ({ ...c, hint: '세계 평균 ' + c.ref + '%' }))}
          empty="주식형 ETF가 없어요."
        />
        <p className="footnote">
          나라·섹터 비중은 각 ETF의 기초지수 대표 구성(S&P500, 코스피 등)으로 추정한 값이에요. 테마 ETF는 해당 섹터 100%로
          봐요. 섹터는 전세계 주식 평균 비중의 1.8배(또는 +10%p)를 넘으면 높음, 주요 섹터가 평균의 40% 미만이면 낮음으로 표시해요.
        </p>
      </Section>
    </>
  )
}


/** 분류형 색 — 순서 고정 (큰 비중부터) */
const SHARE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const OTHER_COLOR = '#c3c8d6'
/** 이 비중 미만은 요약에서 숨기고 '기타'로 묶음 */
const MIN_SHOWN = 3

interface ShareItem {
  key: string
  value: number
  pct: number
  level?: Level
  hint?: string
}

/** 한 줄 막대 + 3% 이상 범례, '자세히 보기'로 전체 목록 */
function ShareCard({ items, empty }: { items: ShareItem[]; empty?: string }) {
  const [open, setOpen] = useState(false)
  const nonzero = items.filter((i) => i.value > 0)
  if (!nonzero.length) {
    return (
      <div className="card">
        <p className="muted">{empty ?? '데이터가 없어요.'}</p>
      </div>
    )
  }
  const main = nonzero.filter((i) => i.pct >= MIN_SHOWN)
  const small = nonzero.filter((i) => i.pct < MIN_SHOWN)
  const smallPct = small.reduce((s, i) => s + i.pct, 0)
  const color = (i: number) => SHARE_COLORS[i % SHARE_COLORS.length]
  const flagged = items.filter((i) => i.level && i.level !== 'ok')

  return (
    <div className="card share">
      <div
        className="share__bar"
        role="img"
        aria-label={main.map((m) => `${m.key} ${m.pct.toFixed(1)}%`).join(', ')}
      >
        {main.map((m, i) => (
          <span key={m.key} style={{ flexGrow: m.pct, background: color(i) }} title={`${m.key} ${m.pct.toFixed(1)}%`} />
        ))}
        {smallPct > 0 && <span style={{ flexGrow: smallPct, background: OTHER_COLOR }} title={`기타 ${smallPct.toFixed(1)}%`} />}
      </div>

      <ul className="share__legend">
        {main.map((m, i) => (
          <li key={m.key}>
            <i className="dot-sm" style={{ background: color(i) }} />
            <span className="share__name">{m.key}</span>
            <b>{m.pct.toFixed(1)}%</b>
            {m.level && <span className={`level level--${m.level}`}>{LEVEL_TEXT[m.level]}</span>}
          </li>
        ))}
        {small.length > 0 && (
          <li className="share__other">
            <i className="dot-sm" style={{ background: OTHER_COLOR }} />
            <span className="share__name">기타 {small.length}개 (각 3% 미만)</span>
            <b>{smallPct.toFixed(1)}%</b>
            {main.some((m) => m.level) && <span className="level level--none" />}
          </li>
        )}
      </ul>

      {flagged.length > 0 && !open && (
        <p className="share__flag">
          {flagged.map((f) => `${f.key} ${f.level === 'high' ? '높음' : '낮음'}`).join(' · ')}
        </p>
      )}

      <button className="share__more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? '접기 ▴' : '자세히 보기 ▾'}
      </button>

      {open && (
        <div className="share__detail">
          {items.map((m) => (
            <ExposureRow key={m.key} label={m.key} pct={m.pct} level={m.level} hint={m.hint} />
          ))}
        </div>
      )}
    </div>
  )
}

function Header() {
  return (
    <header className="hero hero--compact">
      <div className="hero__top">
        <span className="logo">리밸런싱</span>
      </div>
      <p className="hero__hello">목표 비중에 맞춰</p>
      <h1 className="hero__title">
        <b>얼마나 사고 팔지</b> 알려드려요
      </h1>
      <img className="hero__corner" src={ICONS.barChart} alt="" />
    </header>
  )
}

function Action({ r }: { r: RebalanceRow }) {
  if (r.action === 'hold') return <span className="act act--hold">● 유지</span>
  const buy = r.action === 'buy'
  const shares = Math.abs(r.shares)
  return (
    <span className={`act ${buy ? 'act--buy' : 'act--sell'} ${r.within ? 'act--soft' : ''}`}>
      <b>
        {buy ? '▲' : '▼'} {won(Math.abs(r.amount))}
      </b>
      <small>
        {buy ? '매수' : '매도'}{' '}
        {shares > 0 ? `약 ${formatQty(r.symbol, shares)}${unitOf(r.symbol)}` : `1${unitOf(r.symbol)} 미만`}
      </small>
      {r.within && <small>±{TOLERANCE}%p 이내</small>}
    </span>
  )
}

const LEVEL_TEXT: Record<Level, string> = { high: '▲ 높음', ok: '● 적정', low: '▼ 낮음' }

function ExposureRow({ label, pct, level, hint }: { label: string; pct: number; level?: Level; hint?: string }) {
  return (
    <div className="exp-row">
      <div className="exp-row__top">
        <b>{label}</b>
        <span className="exp-row__pct">{pct.toFixed(1)}%</span>
        {level && <span className={`level level--${level}`}>{LEVEL_TEXT[level]}</span>}
      </div>
      <div className="exp-row__bar" aria-hidden>
        <span style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {hint && <span className="exp-row__hint">{hint}</span>}
    </div>
  )
}
