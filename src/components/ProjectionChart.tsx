import { useEffect, useRef, useState } from 'react'
import type { ProjectionPoint } from '../lib/finance'
import { wonAxis, wonShort } from '../lib/format'

interface Props {
  points: ProjectionPoint[]
  target: number
}

const H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 48 }

function niceMax(v: number) {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / exp
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * exp
}

export function ProjectionChart({ points, target }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(entry.contentRect.width, 260)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const maxVal = niceMax(Math.max(target, ...points.map((p) => p.value)) * 1.05)
  const lastYear = points[points.length - 1].year
  const innerW = width - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (year: number) => PAD.left + (lastYear === 0 ? 0 : (year / lastYear) * innerW)
  const y = (v: number) => PAD.top + innerH - (v / maxVal) * innerH

  const line = (key: 'value' | 'contributed') =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p[key]).toFixed(1)}`).join('')
  const area = `${line('value')}L${x(lastYear)},${y(0)}L${x(0)},${y(0)}Z`

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal)
  const xStep = lastYear <= 10 ? 2 : lastYear <= 25 ? 5 : 10
  const xTicks = points.filter((p) => p.year % xStep === 0)

  const reached = points.find((p) => p.value >= target)
  const hp = hover !== null ? points[hover] : null

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const year = Math.round((px / rect.width) * lastYear)
    setHover(Math.max(0, Math.min(points.length - 1, year)))
  }

  return (
    <div className="chart" ref={wrapRef}>
      <div className="legend">
        <span className="legend__item">
          <i className="legend__swatch legend__swatch--value" />
          예상 자산
        </span>
        <span className="legend__item">
          <i className="legend__swatch legend__swatch--contrib" />
          투자 원금
        </span>
        <span className="legend__item">
          <i className="legend__swatch legend__swatch--target" />
          목표
        </span>
      </div>
      <svg width={width} height={H} role="img" aria-label="연도별 예상 자산 그래프">
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 8} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {wonAxis(t)}
            </text>
          </g>
        ))}
        {xTicks.map((p) => (
          <text key={p.year} x={x(p.year)} y={H - 8} className="axis" textAnchor="middle">
            {p.age}세
          </text>
        ))}

        <path d={area} fill="url(#areaFill)" />
        <path d={line('contributed')} className="line line--contrib" />
        <path d={line('value')} className="line line--value" />

        <line x1={PAD.left} x2={width - PAD.right} y1={y(target)} y2={y(target)} className="target" />
        <text x={PAD.left + 6} y={y(target) - 6} className="axis axis--strong">
          목표 {wonShort(target)}
        </text>

        {reached && (
          <g>
            <circle cx={x(reached.year)} cy={y(reached.value)} r={5} className="dot" />
            <text
              x={x(reached.year)}
              y={y(reached.value) + 20}
              className="axis axis--strong"
              textAnchor={x(reached.year) > width - 80 ? 'end' : 'middle'}
            >
              {reached.age}세 달성
            </text>
          </g>
        )}

        {hp && (
          <g pointerEvents="none">
            <line x1={x(hp.year)} x2={x(hp.year)} y1={PAD.top} y2={y(0)} className="crosshair" />
            <circle cx={x(hp.year)} cy={y(hp.contributed)} r={4} className="dot dot--contrib" />
            <circle cx={x(hp.year)} cy={y(hp.value)} r={5} className="dot" />
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hp && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(x(hp.year), 90), width - 90),
            top: Math.max(y(hp.value) - 12, 0),
          }}
        >
          <div className="tooltip__title">
            {hp.age}세 · {hp.year}년 뒤
          </div>
          <div className="tooltip__row">
            <i className="legend__swatch legend__swatch--value" />
            예상 자산 <b>{wonShort(hp.value)}</b>
          </div>
          <div className="tooltip__row">
            <i className="legend__swatch legend__swatch--contrib" />
            투자 원금 <b>{wonShort(hp.contributed)}</b>
          </div>
        </div>
      )}
    </div>
  )
}
