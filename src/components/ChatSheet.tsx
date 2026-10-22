import { useEffect, useRef, useState, type ReactNode } from 'react'
import { sendChat, type ChatTurn } from '../lib/api'
import { ICONS, MASCOT_NAME } from '../lib/characters'
import { Toggle } from './ui'

interface Props {
  /** 지금 포트폴리오 요약 (withAmounts면 금액 포함) */
  getContext: (withAmounts: boolean) => string
  onClose: () => void
}

/** 대화 기록·설정은 포트폴리오 데이터와 따로 이 기기에만 저장 (백업에는 안 들어감) */
const KEY = 'etf-planner/chat'
const MAX_SAVED = 60

interface Saved {
  messages: ChatTurn[]
  withAmounts: boolean
  password: string
}

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null
    return { messages: Array.isArray(s?.messages) ? s.messages : [], withAmounts: !!s?.withAmounts, password: s?.password ?? '' }
  } catch {
    return { messages: [], withAmounts: false, password: '' }
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, messages: s.messages.slice(-MAX_SAVED) }))
  } catch {
    // 저장 공간이 없으면 이번 대화만 유지
  }
}

/** 처음 열었을 때 보여주는 추천 질문 */
const STARTERS = [
  '내 포트폴리오 어때요?',
  '이번 달엔 뭘 사면 좋을까요?',
  '리밸런싱 해야 할까요?',
  '목표까지 얼마나 남았어요?',
  '한 나라나 섹터에 너무 쏠렸나요?',
  '올해 수익률 어때요?',
]
/** 대답 뒤에 이어서 물어볼 만한 질문 */
const FOLLOW_UPS = [
  '좀 더 쉽게 설명해 줄래요?',
  '위험한 부분이 있나요?',
  '배당은 얼마나 나와요?',
  '계좌(ISA·연금)는 잘 쓰고 있나요?',
  '장기적으로 바꿀 점이 있을까요?',
  '수익률이 낮은 종목은 어떻게 할까요?',
  '목표를 더 빨리 이루려면요?',
  ...STARTERS,
]

export function ChatSheet({ getContext, onClose }: Props) {
  const [saved, setSaved] = useState(load)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; text: string } | null>(null)
  const [settings, setSettings] = useState(false)
  const [pw, setPw] = useState(saved.password)
  const listRef = useRef<HTMLDivElement>(null)
  const { messages } = saved

  const update = (p: Partial<Saved>) =>
    setSaved((s) => {
      const next = { ...s, ...p }
      save(next)
      return next
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 새 말이 오면 맨 아래로
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, busy, error])

  async function ask(text: string, password = saved.password) {
    const q = text.trim()
    if (!q || busy) return
    const next: ChatTurn[] = [...messages, { role: 'user', text: q }]
    update({ messages: next })
    setInput('')
    setError(null)
    setBusy(true)
    const res = await sendChat(next, getContext(saved.withAmounts), password)
    setBusy(false)
    if (res.ok) update({ messages: [...next, { role: 'model', text: res.text }] })
    else setError({ code: res.code, text: res.error })
  }

  /** 실패한 마지막 질문을 다시 보냄 */
  async function retry(password = saved.password) {
    const last = messages[messages.length - 1]
    if (last?.role !== 'user' || busy) return
    setError(null)
    setBusy(true)
    const res = await sendChat(messages, getContext(saved.withAmounts), password)
    setBusy(false)
    if (res.ok) update({ messages: [...messages, { role: 'model', text: res.text }] })
    else setError({ code: res.code, text: res.error })
  }

  // 이미 물어본 질문은 빼고 3개씩
  const asked = new Set(messages.filter((m) => m.role === 'user').map((m) => m.text))
  const pool = (messages.length ? FOLLOW_UPS : STARTERS).filter((q) => !asked.has(q))
  const offset = messages.length ? Math.floor(messages.length / 2) % Math.max(pool.length, 1) : 0
  const suggestions = messages.length ? [...pool.slice(offset), ...pool.slice(0, offset)].slice(0, 3) : pool
  const waitingRetry = !busy && !!error && messages[messages.length - 1]?.role === 'user'

  return (
    <div className="modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet modal__sheet chat" role="dialog" aria-label={`${MASCOT_NAME}와 대화`}>
        <div className="sheet__grab" />
        <div className="sheet__head chat__head">
          <img src={ICONS.robot} alt="" className="icon3d icon3d--sm" />
          <span className="chat__title">
            <h2>{MASCOT_NAME}와 대화</h2>
            <span className="muted">내 포트폴리오를 보고 답해요</span>
          </span>
          <button className={`icon-btn ${settings ? 'icon-btn--on' : ''}`} onClick={() => setSettings((o) => !o)} aria-label="대화 설정">
            ⚙
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {settings && (
          <div className="card card--soft chat__settings">
            <div className="chat__setting">
              <span>
                <b>금액도 알려주기</b>
                <span className="muted">끄면 비중(%)과 수익률만 보내요. 무료 Gemini는 대화를 서비스 개선에 쓸 수 있어요.</span>
              </span>
              <Toggle on={saved.withAmounts} onChange={(v) => update({ withAmounts: v })} label="금액도 알려주기" />
            </div>
            <button
              className="link link--danger"
              onClick={() => {
                update({ messages: [] })
                setError(null)
                setSettings(false)
              }}
            >
              대화 기록 지우기
            </button>
          </div>
        )}

        <div className="chat__list" ref={listRef}>
          <Bubble who="model">
            안녕하세요! 저는 {MASCOT_NAME}예요. 앱에 있는 내 포트폴리오를 보고 같이 고민해 드릴게요. 아래 질문을 눌러도 되고, 편하게 물어봐도 돼요.
          </Bubble>
          {messages.map((m, i) => (
            <Bubble key={i} who={m.role}>
              {m.role === 'model' ? renderText(m.text) : m.text}
            </Bubble>
          ))}
          {busy && (
            <Bubble who="model">
              <span className="chat__typing" aria-label="생각하는 중">
                <i />
                <i />
                <i />
              </span>
            </Bubble>
          )}
          {error && (
            <div className="chat__error">
              <p>{error.text}</p>
              {error.code === 'nokey' && <p className="muted">Vercel 환경변수에 GEMINI_API_KEY를 넣으면 대화할 수 있어요.</p>}
              {error.code === 'password' && (
                <form
                  className="chat__pw"
                  onSubmit={(e) => {
                    e.preventDefault()
                    update({ password: pw })
                    retry(pw)
                  }}
                >
                  <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="대화 비밀번호" aria-label="대화 비밀번호" />
                  <button className="btn btn--primary btn--sm">확인</button>
                </form>
              )}
              {waitingRetry && error.code !== 'password' && error.code !== 'nokey' && (
                <button className="link" onClick={() => retry()}>
                  다시 물어보기
                </button>
              )}
            </div>
          )}
        </div>

        {!busy && (
          <div className="chat__chips">
            {suggestions.map((q) => (
              <button key={q} className="chip chat__chip" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        <form
          className="chat__input"
          onSubmit={(e) => {
            e.preventDefault()
            ask(input)
          }}
        >
          <textarea
            rows={1}
            value={input}
            placeholder={`${MASCOT_NAME}에게 물어보기`}
            aria-label="질문 입력"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 컴퓨터에서는 Enter로 보내기, Shift+Enter는 줄바꿈
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                ask(input)
              }
            }}
          />
          <button className="chat__send" disabled={busy || !input.trim()} aria-label="보내기">
            ↑
          </button>
        </form>
        <p className="chat__note">{MASCOT_NAME}의 답은 참고용이에요. 투자 결정은 직접 판단해 주세요.</p>
      </div>
    </div>
  )
}

function Bubble({ who, children }: { who: 'user' | 'model'; children: ReactNode }) {
  return (
    <div className={`chat__row chat__row--${who}`}>
      {who === 'model' && <img src={ICONS.robot} alt="" className="chat__avatar" />}
      <div className={`chat__bubble chat__bubble--${who}`}>{children}</div>
    </div>
  )
}

/** 답의 **굵게**와 '- ' 목록만 살려서 보여줌 */
function renderText(text: string): ReactNode {
  const bold = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part))
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    out.push(
      <ul key={`l${out.length}`}>
        {list.map((l, i) => (
          <li key={i}>{bold(l)}</li>
        ))}
      </ul>,
    )
    list = []
  }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/^#+\s*/, '')
    const item = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(line)
    if (item) {
      list.push(item[1])
      continue
    }
    flush()
    if (line.trim()) out.push(<p key={`p${out.length}`}>{bold(line)}</p>)
  }
  flush()
  return out
}
