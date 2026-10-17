import { lazy, Suspense } from 'react'
import { CHARACTERS, type CharacterId } from '../lib/characters'

// Three.js는 용량이 커서 캐릭터가 처음 보일 때 따로 불러옵니다.
const Mascot3D = lazy(() => import('./Mascot3D'))

export function Mascot({ id, className = '', lively = true }: { id: CharacterId; className?: string; lively?: boolean }) {
  return (
    <div className={`mascot3d ${className}`} role="img" aria-label={`${CHARACTERS.find((c) => c.id === id)?.name} 캐릭터`}>
      <span className="mascot3d__shadow" />
      <Suspense fallback={<span className="mascot3d__ph" />}>
        <Mascot3D id={id} lively={lively} />
      </Suspense>
    </div>
  )
}

export function CharacterPicker({ value, onChange }: { value: CharacterId; onChange: (id: CharacterId) => void }) {
  return (
    <div className="pick" role="radiogroup" aria-label="캐릭터 선택">
      {CHARACTERS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={c.id === value}
          className={`pick__item ${c.id === value ? 'is-on' : ''}`}
          onClick={() => onChange(c.id)}
        >
          <Mascot id={c.id} className="mascot3d--thumb" lively={c.id === value} />
          <b>{c.name}</b>
          <span>{c.intro}</span>
        </button>
      ))}
    </div>
  )
}
