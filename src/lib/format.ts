const nf = new Intl.NumberFormat('ko-KR')

export function won(n: number) {
  return `${nf.format(Math.round(n))}원`
}

/** 1억 2,345만원 형태로 짧게 표시 */
export function wonShort(n: number) {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(Math.round(n))
  const eok = Math.floor(abs / 1e8)
  const man = Math.floor((abs % 1e8) / 1e4)
  if (eok === 0 && man === 0) return `${sign}${nf.format(abs)}원`
  const parts: string[] = []
  if (eok > 0) parts.push(`${nf.format(eok)}억`)
  if (man > 0) parts.push(`${nf.format(man)}만`)
  return `${sign}${parts.join(' ')}원`
}

/** 차트 축용 아주 짧은 표기 */
export function wonAxis(n: number) {
  // 마이너스도 플러스와 같은 단위(억·만)로
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(n)
  if (a >= 1e8) return `${sign}${+(a / 1e8).toFixed(1)}억`
  if (a >= 1e4) return `${sign}${nf.format(Math.round(a / 1e4))}만`
  return `${sign}${nf.format(Math.round(a))}`
}

export function pct(n: number, digits = 1) {
  const s = n.toFixed(digits)
  return `${n > 0 ? '+' : ''}${s}%`
}

export function duration(months: number) {
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}개월`
  if (m === 0) return `${y}년`
  return `${y}년 ${m}개월`
}

export function parseNumber(s: string) {
  const n = Number(s.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function groupDigits(n: number) {
  return n ? nf.format(n) : ''
}
