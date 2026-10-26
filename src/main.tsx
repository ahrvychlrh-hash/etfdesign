import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Splash } from './components/Logo'
import { setupInstall } from './lib/install'
import './styles.css'

// 홈 화면 앱(PWA): 서비스 워커 등록·설치 준비
setupInstall()

// 없앤 '모아와 대화' 기능이 폰에 남긴 대화 기록·Gemini 키·모델 목록을 지움
try {
  for (const k of ['etf-planner/chat', 'etf-planner/gemini-models']) localStorage.removeItem(k)
} catch {
  // 저장소를 못 쓰면 그냥 넘어감
}

/** 앱 위에 시작 로고 화면을 잠깐 띄웁니다. 앱은 뒤에서 미리 준비돼요. */
function Root() {
  const [splash, setSplash] = useState(true)
  const done = useCallback(() => setSplash(false), [])
  return (
    <>
      <App />
      {splash && <Splash onDone={done} />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
