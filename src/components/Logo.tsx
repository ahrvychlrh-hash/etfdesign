import { useEffect, useState } from 'react'

export const APP_NAME = 'ETF DESIGN'

/**
 * 로고 마크: 둥근 사각형 안에 차곡차곡 올라가는 세 막대(= 설계한 포트폴리오가 자라는 모습)와
 * 맨 위에 놓인 동전. 막대 왼쪽 끝을 맞춰 'E' 모양으로도 읽힙니다.
 */
export function LogoMark({ size = 28, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg
      className={`logo-mark ${animate ? 'logo-mark--animate' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label={`${APP_NAME} 로고`}
    >
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6a84ff" />
          <stop offset="1" stopColor="#2f49e6" />
        </linearGradient>
        <linearGradient id="lm-coin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#ffb21a" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="26" fill="url(#lm-bg)" />
      {/* E 모양으로 쌓인 세 막대: 아래가 가장 길고 위로 갈수록 짧아짐 + 왼쪽 기둥 */}
      <rect className="lm-bar lm-bar--1" x="24" y="62" width="48" height="11" rx="5.5" fill="#fff" />
      <rect className="lm-bar lm-bar--2" x="24" y="44" width="36" height="11" rx="5.5" fill="#fff" opacity="0.85" />
      <rect className="lm-bar lm-bar--3" x="24" y="26" width="24" height="11" rx="5.5" fill="#fff" opacity="0.7" />
      <rect className="lm-bar lm-bar--0" x="24" y="26" width="11" height="47" rx="5.5" fill="#fff" />
      {/* 동전 */}
      <circle className="lm-coin" cx="64" cy="31" r="8" fill="url(#lm-coin)" />
      <circle className="lm-coin" cx="64" cy="31" r="4" fill="none" stroke="#fff6d6" strokeWidth="1.6" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <b>ETF</b> DESIGN
    </span>
  )
}

/** 앱을 열 때 잠깐 보이는 로고 화면 — 화면을 누르면 바로 넘어갑니다. */
export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const hold = reduced ? 500 : 1500
    const t1 = setTimeout(() => setLeaving(true), hold)
    const t2 = setTimeout(onDone, hold + 400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onDone])

  return (
    <div className={`splash ${leaving ? 'is-leaving' : ''}`} onClick={onDone} role="presentation">
      <div className="splash__inner">
        <LogoMark size={96} animate />
        <Wordmark />
        <p className="splash__tag">나만의 ETF 포트폴리오를 설계하다</p>
      </div>
    </div>
  )
}
