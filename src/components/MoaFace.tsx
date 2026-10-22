import { useId } from 'react'

/**
 * 모아 얼굴 (정면) — 3D 캐릭터(Mascot3D.tsx)의 머리 비율을 그대로 옮긴 가벼운 그림.
 * 대화창 프로필처럼 작게 여러 번 보여줄 때 씁니다. (좌표는 3D 단위 × 100, 위아래만 뒤집음)
 */
export function MoaFace({ size = 28, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={className} width={size} height={size} viewBox="-125 -122 250 250" aria-hidden>
      <defs>
        <radialGradient id={`${id}h`} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef2f8" />
          <stop offset="1" stopColor="#d3dbe8" />
        </radialGradient>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b3d6e" />
          <stop offset="1" stopColor="#141f40" />
        </linearGradient>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5aa9f5" />
          <stop offset="0.5" stopColor="#8cc8ff" />
          <stop offset="1" stopColor="#5aa9f5" />
        </linearGradient>
      </defs>

      {/* 안테나 (오른쪽 끝은 빛나는 노란 구슬) */}
      <line x1="-36" y1="-64" x2="-58" y2="-100" stroke="#8cc8ff" strokeWidth="6" strokeLinecap="round" />
      <line x1="36" y1="-64" x2="58" y2="-100" stroke="#8cc8ff" strokeWidth="6" strokeLinecap="round" />
      <circle cx="-58" cy="-100" r="9" fill="#f8fafd" stroke="#d3dbe8" strokeWidth="1.5" />
      <circle cx="58" cy="-100" r="9" fill="#ffe39a" />

      {/* 헤드폰 귀 */}
      <rect x="-114" y="-26" width="28" height="60" rx="13" fill={`url(#${id}e)`} />
      <rect x="86" y="-26" width="28" height="60" rx="13" fill={`url(#${id}e)`} />

      {/* 머리 */}
      <ellipse cx="0" cy="0" rx="101" ry="77" fill={`url(#${id}h)`} />
      {/* 정수리 패널 선 */}
      <path d="M -36 -50 Q 0 -70 36 -50" fill="none" stroke="#8cc8ff" strokeWidth="2.5" strokeLinecap="round" />

      {/* 유리 얼굴 */}
      <ellipse cx="0" cy="8" rx="86" ry="46" fill={`url(#${id}v)`} />
      <ellipse cx="-28" cy="-22" rx="38" ry="8" fill="#ffffff" opacity="0.14" />

      {/* 빛나는 눈과 미소 */}
      <ellipse cx="-31" cy="4" rx="15" ry="17" fill="#8ff4ff" />
      <ellipse cx="31" cy="4" rx="15" ry="17" fill="#8ff4ff" />
      <path d="M -9 27 A 9 9 0 0 0 9 27" fill="none" stroke="#8ff4ff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
