import { useEffect, useState } from 'react'
import { canPrompt, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/install'
import { Section } from './ui'

/** 홈 화면 앱 설치 안내 — 이미 앱으로 열었으면 안 보임 */
export function InstallSection() {
  const [, setTick] = useState(0)
  const [done, setDone] = useState(false)
  useEffect(() => onInstallChange(() => setTick((t) => t + 1)), [])
  if (isStandalone()) return null

  return (
    <Section title="홈 화면에 앱 설치">
      <div className="card install">
        <img src="/icon-192.png" alt="" className="install__icon" />
        <div className="install__text">
          <b>앱처럼 쓰기</b>
          <span className="muted">
            홈 화면 아이콘으로 바로 열리고, 주소창 없이 전체 화면으로 보여요. 브라우저보다 데이터가 지워질 일도 적어요.
          </span>
          {done ? (
            <span className="install__ok">설치했어요! 홈 화면의 ETF DESIGN 아이콘으로 열어 보세요.</span>
          ) : canPrompt() ? (
            <button className="btn btn--primary btn--sm install__btn" onClick={async () => setDone(await promptInstall())}>
              앱으로 설치
            </button>
          ) : isIos() ? (
            <ol className="install__steps">
              <li>사파리 아래쪽 공유 버튼(□↑)을 누르고</li>
              <li>
                <b>홈 화면에 추가</b>를 누르세요
              </li>
            </ol>
          ) : (
            <ol className="install__steps">
              <li>브라우저 메뉴(⋮ 또는 ≡)를 누르고</li>
              <li>
                <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 누르세요
              </li>
            </ol>
          )}
        </div>
      </div>
    </Section>
  )
}
