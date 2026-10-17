import { useState, type ReactNode } from 'react'

/**
 * 한 번 더 확인하는 버튼. 브라우저 confirm()은 앱 내장 브라우저 등에서
 * 막혀 항상 '취소'가 되는 경우가 있어 화면 안에서 확인합니다.
 */
export function ConfirmButton(props: {
  label: string
  question: string
  confirmLabel: string
  onConfirm: () => void
  className?: string
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className={props.className} onClick={() => setAsking(true)}>
        {props.label}
      </button>
    )
  }
  return (
    <span className="confirm" role="alertdialog" aria-label={props.question}>
      <span className="confirm__q">{props.question}</span>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(false)}>
        취소
      </button>
      <button type="button" className="btn btn--danger-solid btn--sm" autoFocus onClick={props.onConfirm}>
        {props.confirmLabel}
      </button>
    </span>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? 'is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section__head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export type Tab = 'home' | 'holdings' | 'history' | 'rebalance' | 'goal'

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: ReactNode }[] = [
    {
      id: 'home',
      label: '홈',
      icon: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
    },
    {
      id: 'holdings',
      label: '보유 ETF',
      icon: <path d="M5 19V11M10 19V6M15 19v-5M20 19V9" strokeLinecap="round" />,
    },
    {
      id: 'history',
      label: '기록',
      icon: (
        <>
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M4 10h16M9 3v4M15 3v4" strokeLinecap="round" />
        </>
      ),
    },
    {
      id: 'rebalance',
      label: '리밸런싱',
      icon: (
        <>
          <path d="M12 4v16M5 8h14" strokeLinecap="round" />
          <path d="M5 8l-2.5 6a2.5 2.5 0 0 0 5 0zM19 8l-2.5 6a2.5 2.5 0 0 0 5 0z" />
        </>
      ),
    },
    {
      id: 'goal',
      label: '내 목표',
      icon: (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="3.5" />
        </>
      ),
    },
  ]
  return (
    <nav className="tabbar" aria-label="메뉴">
      {items.map((it) => (
        <button key={it.id} className={tab === it.id ? 'is-on' : ''} onClick={() => onChange(it.id)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            {it.icon}
          </svg>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
