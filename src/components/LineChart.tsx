import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface LineSeries {
  name: string
  color: string
  /** labels와 같은 순서 — 값이 없으면 null */
  values: (number | null)[]
  /** 굵게(내 수익률 등) */
  bold?: boolean
}

interface Props {
  series: LineSeries[]
  /** 가로축 각 점의 이름 (상세 내용 제목) */
  labels: string[]
  /** 가로축에 보일 짧은 글자 — 빈 문자열이면 안 보임 */
  ticks?: string[]
  /** 세로축·상세 값 표시 */
  format: (v: number) => string
  height?: number
  /** 0에 기준선 (수익률 그래프) */
  zeroLine?: boolean
  /** 한 줄짜리면 아래를 옅게 칠함 */
  area?: boolean
  /** 상세 내용 아래에 덧붙일 것 */
  tipExtra?: (i: number) => ReactNode
}

const PAD = { top: 12, right: 10, bottom: 24, left: 46 }

/** 선 그래프 — 누르거나 끌면 그 지점 값이 보이고, 그래프 바깥을 누르면 닫힘 */
export function LineChart({ series, labels, ticks, format, height = 200, zeroLine, area, tipExtra }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [at, setAt] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(e.contentRect.width, 240)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (at === null) return
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setAt(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [at])

  const n = labels.length
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null))
  if (zeroLine) all.push(0)
  let min = Math.min(...all)
  let max = Math.max(...all)
  if (!all.length) {
    min = 0
    max = 1
  }
  if (max === min) {
    max += 1
    min -= 1
  }
  const padV = (max - min) * 0.08
  max += padV
  min -= zeroLine && min >= 0 ? 0 : padV
  const innerW = width - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * innerH

  const path = (vals: (number | null)[]) => {
    let d = ''
    let pen = false
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }
  const yTicks = [max - padV, (max + min) / 2, min + (zeroLine && min >= 0 ? 0 : padV)]

  function pick(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1))
    setAt(Math.max(0, Math.min(n - 1, i)))
  }

  const first = series[0]
  const areaD =
    area && first && first.values.some((v) => v != null)
      ? `${path(first.values)}L${x(n - 1)},${PAD.top + innerH}L${x(first.values.findIndex((v) => v != null))},${PAD.top + innerH}Z`
      : null

  return (
    <div className="chart" ref={wrap}>
      <svg width={width} height={height} role="img" aria-label="선 그래프">
        {areaD && (
          <defs>
            <linearGradient id="lineArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={first.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={first.color} stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {zeroLine && min < 0 && max > 0 && <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} className="axis-zero" />}
        {ticks?.map((t, i) =>
          t ? (
            <text key={i} x={x(i)} y={height - 6} className="axis" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {t}
            </text>
          ) : null,
        )}
        {areaD && <path d={areaD} fill="url(#lineArea)" />}
        {/* 굵은 선(내 수익률)을 맨 위에 */}
        {[...series]
          .sort((a, b) => Number(!!a.bold) - Number(!!b.bold))
          .map((s) => (
            <path
              key={s.name}
              d={path(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.bold ? 3 : 1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={s.bold || series.length === 1 ? 1 : 0.85}
            />
          ))}
        {at !== null && (
          <g pointerEvents="none">
            <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={PAD.top + innerH} className="crosshair" />
            {series.map((s) =>
              s.values[at] != null ? (
                <circle key={s.name} cx={x(at)} cy={y(s.values[at]!)} r={s.bold ? 5 : 3.5} fill={s.color} stroke="#fff" strokeWidth={2} />
              ) : null,
            )}
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onPointerDown={pick}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setAt(null)}
        />
      </svg>
      {at !== null && (
        <div className="tooltip" style={{ left: Math.min(Math.max(x(at), 90), width - 90), top: PAD.top }}>
          <div className="tooltip__title">{labels[at]}</div>
          {series.map((s) =>
            s.values[at] != null ? (
              <div key={s.name} className="tooltip__row">
                <i className="legend__swatch" style={{ background: s.color }} />
                {s.name} <b>{format(s.values[at]!)}</b>
              </div>
            ) : null,
          )}
          {tipExtra?.(at)}
        </div>
      )}
    </div>
  )
}
