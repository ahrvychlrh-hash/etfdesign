// UI 아이콘: Microsoft Fluent Emoji 3D (MIT License) — https://github.com/microsoft/fluentui-emoji
const BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets'

export function emoji3d(folder: string) {
  const file = folder.toLowerCase().replace(/ /g, '_')
  return `${BASE}/${encodeURIComponent(folder)}/3D/${file}_3d.png`
}

/** 메인 캐릭터 이름 — 모델은 components/Mascot3D.tsx */
export const MASCOT_NAME = '콤코미'

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
