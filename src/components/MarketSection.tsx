import { useEffect, useState } from 'react'
import { fetchIndexHistory, fetchMarketNow, indexChange, indexValue, type IndexNow, type Range } from '../lib/market'
import { wonAxis } from '../lib/format'
import { LineChart } from './LineChart'
import { Section } from './ui'

const UP = '#f04452'
const DOWN = '#3182f6'
const tone = (v: number) => (v > 0 ? UP : v < 0 ? DOWN : '#9a9fb3')

/** 홈: 코스피·코스닥·S&P500·나스닥·VIX 등 시장 지수 */
export function MarketSection() {
  const [list, setList] = useState<IndexNow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<IndexNow | null>(null)
  const [all, setAll] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchMarketNow()
        .then((l) => alive && (setList(l), setFailed(false)))
        .catch(() => alive && setFailed(true))
    load()
    // 화면을 보고 있는 동안 2분마다 새로
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 120_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const shown = list ? (all ? list : list.slice(0, 6)) : []
  const latest = list?.length ? Math.max(...list.map((i) => i.time)) : 0

  return (
    <Section
      title="시장 지수"
      action={latest ? <span className="muted market__time">{timeLabel(latest)} 기준</span> : undefined}
    >
      {!list && !failed && <div className="card market__empty muted">지수를 불러오는 중…</div>}
      {failed && !list && <div className="card market__empty muted">지수를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</div>}
      {list && (
        <>
          <div className="market">
            {shown.map((ix) => (
              <button key={ix.id} className="card card--btn market__card" onClick={() => setOpen(ix)}>
                <span className="market__top">
                  <span className="market__name">{ix.name}</span>
                  <span className="market__chg" style={{ color: tone(ix.change) }}>
                    {indexChange(ix)}
                  </span>
                </span>
                <span className="market__bottom">
                  <b className="market__price">{indexValue(ix.unit, ix.price)}</b>
                  <Spark values={ix.spark} color={tone(ix.spark[ix.spark.length - 1] - ix.spark[0])} />
                </span>
              </button>
            ))}
          </div>
          {list.length > 6 && (
            <button className="share__more" onClick={() => setAll((a) => !a)}>
              {all ? '접기 ▴' : `지수 ${list.length - 6}개 더 보기 ▾`}
            </button>
          )}
          <p className="footnote">작은 그래프는 최근 한 달 흐름이에요. 지수는 15~20분 늦을 수 있고, 누르면 기간별로 볼 수 있어요.</p>
        </>
      )}
      {open && <IndexSheet ix={open} onClose={() => setOpen(null)} />}
    </Section>
  )
}

function timeLabel(sec: number) {
  const d = new Date(sec * 1000)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 최근 흐름 작은 선 */
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 100
  const h = 22
  const min = Math.min(...values)
  const max = Math.max(...values)
  const d = values
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - min) / (max - min || 1)) * (h - 4) - 2).toFixed(1)}`)
    .join('')
  return (
    <svg className="market__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

const RANGES: { id: Range; label: string }[] = [
  { id: '1mo', label: '1개월' },
  { id: '3mo', label: '3개월' },
  { id: '1y', label: '1년' },
  { id: '5y', label: '5년' },
  { id: '10y', label: '10년' },
]

/** 지수 하나 자세히 — 기간별 흐름 */
function IndexSheet({ ix, onClose }: { ix: IndexNow; onClose: () => void }) {
  const [range, setRange] = useState<Range>('1y')
  const [pts, setPts] = useState<[number, number][] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setPts(null)
    setFailed(false)
    fetchIndexHistory(ix.id, range)
      .then((p) => alive && setPts(p))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [ix.id, range])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const first = pts?.[0]?.[1]
  const last = pts?.[pts.length - 1]?.[1]
  const periodChg = first && last ? (last / first - 1) * 100 : null
  const hi = pts ? Math.max(...pts.map((p) => p[1])) : null
  const lo = pts ? Math.min(...pts.map((p) => p[1])) : null
  const dateOf = (t: number) => {
    const d = new Date(t * 1000)
    return range === '1mo' || range === '3mo'
      ? `${d.getMonth() + 1}/${d.getDate()}`
      : range === '1y'
        ? `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}`
        : `${d.getFullYear()}`
  }
  const fullDate = (t: number) => {
    const d = new Date(t * 1000)
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  }
  // 가로축 글자는 4~5개만
  const step = pts ? Math.max(1, Math.floor((pts.length - 1) / 4)) : 1
  // 마지막 글자와 너무 가까운 칸은 건너뜀 (겹치지 않게)
  const ticks = pts
    ? pts.map((p, i) => (i === pts.length - 1 || (i % step === 0 && pts.length - 1 - i >= step / 2) ? dateOf(p[0]) : ''))
    : []

  return (
    <div className="modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet modal__sheet" role="dialog" aria-label={`${ix.name} 지수`}>
        <div className="sheet__grab" />
        <div className="sheet__head">
          <h2>{ix.name}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="index__now">
          <b>{indexValue(ix.unit, ix.price)}</b>
          <span style={{ color: tone(ix.change) }}>오늘 {indexChange(ix)}</span>
        </div>
        {ix.note && <p className="hint hint--sm">{ix.note}</p>}

        <div className="chips index__ranges">
          {RANGES.map((r) => (
            <button key={r.id} className={`chip chip--select chip--sm ${range === r.id ? 'is-on' : ''}`} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="index__chart">
          {!pts && !failed && <p className="muted">불러오는 중…</p>}
          {failed && <p className="muted">불러오지 못했어요.</p>}
          {pts && pts.length > 1 && (
            <LineChart
              series={[{ name: ix.name, color: tone(periodChg ?? 0), values: pts.map((p) => p[1]), bold: true }]}
              labels={pts.map((p) => fullDate(p[0]))}
              ticks={ticks}
              format={(v) => axisLabel(ix.unit, v)}
              area
              height={220}
            />
          )}
        </div>

        {pts && periodChg != null && (
          <div className="index__stats">
            <span>
              <span className="muted">기간 수익률</span>
              <b style={{ color: tone(periodChg) }}>
                {periodChg > 0 ? '+' : ''}
                {periodChg.toFixed(1)}%
              </b>
            </span>
            <span>
              <span className="muted">최고</span>
              <b>{indexValue(ix.unit, hi!)}</b>
            </span>
            <span>
              <span className="muted">최저</span>
              <b>{indexValue(ix.unit, lo!)}</b>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** 그래프 세로축 — 원화는 만·억 단위로 */
function axisLabel(unit: IndexNow['unit'], v: number) {
  if (unit === 'pct') return `${v.toFixed(2)}%`
  if (unit === 'won' && v >= 1e4) return wonAxis(v)
  if (v >= 10000) return `${Math.round(v / 1000)}k`
  return v.toLocaleString('ko-KR', { maximumFractionDigits: v < 100 ? 2 : 0 })
}
