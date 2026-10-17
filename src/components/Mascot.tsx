import { lazy, Suspense } from 'react'
import { MASCOT_NAME } from '../lib/characters'

// Three.js는 용량이 커서 캐릭터가 처음 보일 때 따로 불러옵니다.
const Mascot3D = lazy(() => import('./Mascot3D'))

/** 메인 캐릭터 — 로봇 '모아' */
export function Mascot({ className = '', lively = true }: { className?: string; lively?: boolean }) {
  return (
    <div className={`mascot3d ${className}`} role="img" aria-label={`${MASCOT_NAME} 캐릭터`}>
      <span className="mascot3d__shadow" />
      <Suspense fallback={<span className="mascot3d__ph" />}>
        <Mascot3D lively={lively} />
      </Suspense>
    </div>
  )
}
