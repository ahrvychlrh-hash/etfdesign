import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Splash } from './components/Logo'
import './styles.css'

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
