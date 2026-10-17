import { useMemo, useState } from 'react'
import type { Holding } from '../lib/types'
import { ICONS } from '../lib/characters'
import { positions, rebalance, TOLERANCE, type RebalanceRow } from '../lib/rebalance'
import { judgeCountries, judgeSectors, portfolioExposure, type Level } from '../lib/exposure'
import { colorMap } from '../lib/plan'
import { won, wonShort } from '../lib/format'
import { primaryLabel, secondaryLabel } from '../lib/presets'
import { MoneyInput } from './MoneyInput'
import { Section, Toggle } from './ui'

interface Props {
  holdings: Holding[]
  targets: Record<string, number>
  monthly: number
  onTargets: (t: Record<string, number>) => void
}

export function Rebalance({ holdings, targets, monthly, onTargets }: Props) {
  const list = useMemo(() => positions(holdings), [holdings])
  const [extra, setExtra] = useState(monthly)
  const [buyOnly, setBuyOnly] = useState(false)
  // 입력 중인 값("33.")을 그대로 보여주기 위해 문자열로 보관
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const sumTarget = list.reduce((s, p) => s + (targets[p.symbol] ?? 0), 0)
  const hasTargets = sumTarget > 0
  const rows = rebalance(list, targets, extra, buyOnly)
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
  /** 반올림 오차는 가장 큰 종목에 몰아서 합계를 정확히 100%로 */
  function fill(next: Record<string, number>) {
    const keys = Object.keys(next)
    if (keys.length) {
      const diff = Math.round((100 - keys.reduce((s, k) => s + next[k], 0)) * 10) / 10
      const top = keys.reduce((a, b) => (next[b] > next[a] ? b : a))
      next = { ...next, [top]: Math.round((next[top] + diff) * 10) / 10 }
    }
    setDrafts({})
    onTargets(next)
  }
  const total = list.reduce((s, p) => s + p.value, 0)

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
          <span className="form-item__label">이번에 추가로 넣을 돈</span>
          <MoneyInput id="extra" value={extra} onChange={setExtra} />
        </div>
        <div className="reinvest reinvest--flat">
          <div className="reinvest__text">
            <b>팔지 않고 추가 매수로만 맞추기</b>
            <span className="muted">끄면 많은 종목은 팔고 적은 종목은 사서 정확히 맞춰요</span>
          </div>
          <Toggle on={buyOnly} onChange={setBuyOnly} label="추가 매수로만 맞추기" />
        </div>
      </div>

      <Section
        title="현재 비중 · 목표 비중"
        action={
          <span className={`sum-badge ${Math.abs(sumTarget - 100) < 0.05 ? 'is-ok' : hasTargets ? 'is-warn' : ''}`}>
            목표 합계 {sumTarget.toFixed(1)}%
          </span>
        }
      >
        <div className="chips chips--wrap reb-fill">
          <button
            className="chip"
            onClick={() => fill(Object.fromEntries(list.map((p) => [p.symbol, Math.round((p.value / total) * 1000) / 10])))}
          >
            현재 비중으로 채우기
          </button>
          <button className="chip" onClick={() => fill(Object.fromEntries(list.map((p) => [p.symbol, Math.round(1000 / list.length) / 10])))}>
            똑같이 나누기
          </button>
          {hasTargets && (
            <button className="chip chip--ghost" onClick={() => fill({})}>
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
          목표와 ±{TOLERANCE}%p 이내면 '유지'로 표시해요. 같은 ETF가 여러 계좌에 있으면 합쳐서 계산하고, 주식 수는 현재가 기준
          대략치예요.
        </p>
      </Section>

      <Section title="자산군 비중">
        <div className="card">
          <div className="alloc alloc--inline" aria-hidden>
            {exposure.asset.map((s, i) => (
              <span key={s.key} style={{ flexGrow: s.value, background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
            ))}
          </div>
          <ul className="legend-list">
            {exposure.asset.map((s, i) => (
              <li key={s.key}>
                <i className="dot-sm" style={{ background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                <span>{s.key}</span>
                <b>{s.pct.toFixed(1)}%</b>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="나라별 비중">
        <div className="card">
          {judgeCountries(exposure.country).map((s) => (
            <ExposureRow key={s.key} label={s.key} pct={s.pct} level={s.level} hint={`적정 ${s.range[0]}~${s.range[1]}%`} />
          ))}
        </div>
      </Section>

      <Section title="섹터별 비중 (주식 부분)">
        <div className="card">
          {exposure.sector.length === 0 ? (
            <p className="muted">주식형 ETF가 없어요.</p>
          ) : (
            judgeSectors(exposure.sector).map((s) => (
              <ExposureRow key={s.key} label={s.key} pct={s.pct} level={s.level} hint={`세계 평균 ${s.ref}%`} />
            ))
          )}
        </div>
        <p className="footnote">
          나라·섹터 비중은 각 ETF의 기초지수 대표 구성(S&P500, 코스피 등)으로 추정한 값이에요. 테마 ETF는 해당 섹터 100%로
          봐요. 섹터는 전세계 주식 평균 비중의 1.8배(또는 +10%p)를 넘으면 높음, 주요 섹터가 평균의 40% 미만이면 낮음으로 표시해요.
        </p>
      </Section>
    </>
  )
}

const ASSET_COLORS = ['#3d5afe', '#1baf7a', '#f5a400', '#9aa3bf', '#e87ba4', '#7b5cff']

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
  return (
    <span className={`act ${buy ? 'act--buy' : 'act--sell'}`}>
      <b>
        {buy ? '▲ 매수' : '▼ 매도'} {wonShort(Math.abs(r.amount))}
      </b>
      <small>약 {Math.abs(r.shares).toLocaleString('ko-KR')}주</small>
    </span>
  )
}

const LEVEL_TEXT: Record<Level, string> = { high: '▲ 높음', ok: '● 적정', low: '▼ 낮음' }

function ExposureRow({ label, pct, level, hint }: { label: string; pct: number; level: Level; hint: string }) {
  return (
    <div className="exp-row">
      <div className="exp-row__top">
        <b>{label}</b>
        <span className="exp-row__pct">{pct.toFixed(1)}%</span>
        <span className={`level level--${level}`}>{LEVEL_TEXT[level]}</span>
      </div>
      <div className="exp-row__bar" aria-hidden>
        <span style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="exp-row__hint">{hint}</span>
    </div>
  )
}
