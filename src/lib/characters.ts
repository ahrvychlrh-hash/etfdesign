// UI 아이콘: Microsoft Fluent Emoji 3D (MIT License) — https://github.com/microsoft/fluentui-emoji
const BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets'

export function emoji3d(folder: string) {
  const file = folder.toLowerCase().replace(/ /g, '_')
  return `${BASE}/${encodeURIComponent(folder)}/3D/${file}_3d.png`
}

/** 메인 캐릭터 3종 — 실제 모델은 components/Mascot3D.tsx */
export const CHARACTERS = [
  { id: 'star', name: '별이', intro: '반짝반짝 별이' },
  { id: 'momo', name: '몽이', intro: '복슬복슬 몽이' },
  { id: 'robo', name: '로보', intro: '척척박사 로보' },
] as const

export type CharacterId = (typeof CHARACTERS)[number]['id']

export function character(id: CharacterId | undefined) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]
}

/** 받침 조사: 별이와 / 로보와 */
export function withWa(name: string) {
  const code = name.charCodeAt(name.length - 1) - 0xac00
  return code >= 0 && code % 28 !== 0 ? `${name}과` : `${name}와`
}

export const ICONS = {
  calendar: emoji3d('Spiral calendar'),
  chart: emoji3d('Chart increasing'),
  moneyBag: emoji3d('Money bag'),
  bullseye: emoji3d('Bullseye'),
  coin: emoji3d('Coin'),
  search: emoji3d('Magnifying glass tilted left'),
  seedling: emoji3d('Seedling'),
  sparkles: emoji3d('Sparkles'),
  trophy: emoji3d('Trophy'),
  rocket: emoji3d('Rocket'),
  bank: emoji3d('Bank'),
  bulb: emoji3d('Light bulb'),
  hourglass: emoji3d('Hourglass not done'),
  barChart: emoji3d('Bar chart'),
  briefcase: emoji3d('Briefcase'),
  banknote: emoji3d('Dollar banknote'),
}
