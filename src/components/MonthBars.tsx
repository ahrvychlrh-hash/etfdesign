import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface Bar {
  key: string
  /** 'YYYY-MM' */
  month: string
  value: number
  /** 막대 색 (없으면 기본 파랑) */
  color?: string
  /** 진행 중인 달은 옅게 */
  faded?: boolean
}

interface Props {
  bars: Bar[]
  /** 축 눈금 표시 */
  format: (v: number) => string
  /** 막대 위 툴팁 내용 */
  tooltip: (bar: Bar) => ReactNode
  height?: number
  /** 막대 위에 겹쳐 그리는 선 (막대와 같은 순서) — 오른쪽 눈금, 0 위치는 막대와 같음 */
  line?: { values: number[]; format: (v: number) => string }
}

const PAD = { top: 12, right: 8, bottom: 30, left: 44 }
const LINE_COLOR = '#5b6478'

/** 월별 막대 그래프 — 0을 기준으로 위(+)·아래(-)로 그립니다. 해가 바뀌는 곳에 연도를 표시합니다. */
export function MonthBars({ bars, format, tooltip, height = 190, line }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  // 마우스를 올린 막대(컴퓨터) / 터치로 고정한 막대(휴대폰)
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const shown = pinned ?? hover

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(e.contentRect.width, 240)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 고정된 상세 내용은 그래프 바깥을 누르면 닫힘
  useEffect(() => {
    if (pinned == null) return
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setPinned(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [pinned])

  const padRight = line ? 48 : PAD.right
  // 선 값을 막대 단위로 바꾸는 비율 — 두 값의 최대 크기를 맞춤
  const barAbs = Math.max(...bars.map((b) => Math.abs(b.value)), 0)
  const lineAbs = line ? Math.max(...line.values.map((v) => Math.abs(v)), 0) : 0
  const k = barAbs > 0 && lineAbs > 0 ? barAbs / lineAbs : 1
  const lineAsBar = line ? line.values.map((v) => v * k) : []
  const max = Math.max(0, ...bars.map((b) => b.value), ...lineAsBar)
  const min = Math.min(0, ...bars.map((b) => b.value), ...lineAsBar)
  const span = max - min || 1
  const innerW = width - PAD.left - padRight
  const innerH = height - PAD.top - PAD.bottom
  const y = (v: number) => PAD.top + ((max - v) / span) * innerH
  const slot = innerW / Math.max(bars.length, 1)
  const barW = Math.max(Math.min(slot * 0.62, 26), 3)
  const x = (i: number) => PAD.left + slot * i + slot / 2
  // 모두 마이너스면 0이 두 번 나오지 않게 0·중간·최저로
  const ticks = min < 0 ? (max > 0 ? [max, 0, min] : [0, min / 2, min]) : [max, max / 2, 0]
  // 월이 많으면 1·4·7·10월만 표시
  const showLabel = (m: number) => bars.length <= 8 || [1, 4, 7, 10].includes(m)
  const hb = shown != null ? bars[shown] : null

  return (
    <div className="chart" ref={wrap}>
      <svg width={width} height={height} role="img" aria-label="월별 그래프">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={width - padRight} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-zero' : 'grid'} />
            <text x={PAD.left - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
            {line && (
              <text x={width - padRight + 6} y={y(t)} className="axis" textAnchor="start" dominantBaseline="middle">
                {line.format(t / k)}
              </text>
            )}
          </g>
        ))}
        {bars.map((b, i) => {
          const top = Math.min(y(b.value), y(0))
          const h = Math.max(Math.abs(y(b.value) - y(0)), b.value === 0 ? 0 : 2)
          const [yy, mm] = b.month.split('-').map(Number)
          const newYear = i === 0 || mm === 1
          return (
            <g key={b.key}>
              {newYear && i > 0 && (
                <line x1={x(i) - slot / 2} x2={x(i) - slot / 2} y1={PAD.top} y2={height - PAD.bottom + 4} className="year-line" />
              )}
              <rect
                x={x(i) - barW / 2}
                y={top}
                width={barW}
                height={h}
                rx={Math.min(4, barW / 2)}
                fill={b.color ?? 'var(--series-1)'}
                opacity={b.faded ? 0.45 : shown === null || shown === i ? 1 : 0.55}
              />
              {showLabel(mm) && (
                <text x={x(i)} y={height - PAD.bottom + 14} className="axis" textAnchor="middle">
                  {mm}월
                </text>
              )}
              {newYear && (
                <text x={x(i) - slot / 2 + 2} y={height - 3} className="axis axis--strong">
                  {yy}
                </text>
              )}
            </g>
          )
        })}
        {line && bars.length > 0 && (
          <g pointerEvents="none">
            <polyline
              points={lineAsBar.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {lineAsBar.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={shown === i ? 4 : 2.5} fill="#fff" stroke={LINE_COLOR} strokeWidth={2} />
            ))}
          </g>
        )}
        {/* 막대보다 넓은 마우스·터치 영역 */}
        {bars.map((b, i) => (
          <rect
            key={`hit-${b.key}`}
            x={x(i) - slot / 2}
            y={PAD.top}
            width={slot}
            height={innerH}
            fill="transparent"
            // 마우스는 올리면 보이고, 터치는 한 번 누르면 고정 (같은 막대를 다시 누르면 닫힘)
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(i)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
            onClick={() => setPinned((p) => (p === i ? null : i))}
          />
        ))}
      </svg>
      {hb && shown != null && (
        <div className="tooltip" style={{ left: Math.min(Math.max(x(shown), 90), width - 90), top: Math.max(y(Math.max(hb.value, 0)) - 8, 0) }}>
          {tooltip(hb)}
        </div>
      )}
    </div>
  )
}
