/**
 * 홈 화면 앱(PWA) 설치 도우미.
 * 안드로이드 크롬은 설치 창을 띄울 수 있는 이벤트(beforeinstallprompt)를 앱 시작 때 한 번 주므로
 * 미리 받아 두었다가 '앱으로 설치' 버튼에서 씁니다. 아이폰은 사파리 공유 메뉴로만 설치돼요.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** 앱 시작 때 한 번: 서비스 워커 등록 + 설치 이벤트 받아 두기 */
export function setupInstall() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
  // 개발 중(내 컴퓨터 주소)에는 저장본 때문에 수정이 안 보이는 일이 없게 배포판에서만
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname)
  if (!local && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
  }
}

export function onInstallChange(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** 이미 홈 화면 앱으로 열려 있는지 */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function canPrompt() {
  return deferred !== null
}

/** 설치 창 띄우기 — 설치했으면 true */
export async function promptInstall() {
  if (!deferred) return false
  const e = deferred
  deferred = null
  await e.prompt()
  const { outcome } = await e.userChoice
  notify()
  return outcome === 'accepted'
}
