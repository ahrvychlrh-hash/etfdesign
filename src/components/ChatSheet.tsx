import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchChatStatus, sendChat, type ChatTurn } from '../lib/api'
import { checkGeminiKey } from '../../server/chat'
import { MASCOT_NAME } from '../lib/characters'
import { MoaFace } from './MoaFace'
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
  /** 사용자가 연결한 자기 Gemini 키 — 이 기기에만 저장, Google로만 보냄 */
  apiKey: string
}

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null
    const messages = Array.isArray(s?.messages) ? [...s.messages] : []
    while (messages.length && messages[messages.length - 1].role === 'user') messages.pop()
    return {
      messages,
      withAmounts: !!s?.withAmounts,
      password: s?.password ?? '',
      apiKey: s?.apiKey ?? '',
    }
  } catch {
    return { messages: [], withAmounts: false, password: '', apiKey: '' }
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
  /** 지금 만들어지고 있는 답 (글자가 오는 대로 보여줌) */
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<{ code: string; text: string } | null>(null)
  const [settings, setSettings] = useState(false)
  const [pw, setPw] = useState(saved.password)
  /** 서버에 키가 있는지 (null: 아직 모름) */
  const [serverKey, setServerKey] = useState<boolean | null>(null)
  /** 내 키 연결 화면을 직접 연 경우 */
  const [connecting, setConnecting] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const { messages, apiKey } = saved
  // 내 키도 없고 서버 키도 없으면 연결 화면부터
  const needsKey = connecting || (!apiKey && serverKey === false)

  useEffect(() => {
    if (apiKey) return
    fetchChatStatus().then((s) => s && setServerKey(s.serverKey))
  }, [apiKey])

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
  }, [messages.length, busy, error, partial])

  async function ask(text: string, password = saved.password) {
    const q = text.trim()
    if (!q || busy) return
    const next: ChatTurn[] = [...messages, { role: 'user', text: q }]
    update({ messages: next })
    setInput('')
    setError(null)
    setBusy(true)
    setPartial('')
    const res = await sendChat(next, getContext(saved.withAmounts), password, apiKey || undefined, (t) => setPartial((p) => p + t))
    setBusy(false)
    setPartial('')
    if (res.ok) {
      update({ messages: [...next, { role: 'model', text: res.text }] })
      return
    }
    // 답을 못 받으면 질문은 기록에서 빼고 입력칸에 돌려둠 — 저절로 다시 보내지 않음
    update({ messages })
    setInput(q)
    if (res.code === 'nokey') setServerKey(false)
    setError({ code: res.code, text: res.error })
  }

  /** 내 키 연결 — 확인되면 저장만 하고, 질문은 사용자가 직접 보냄 */
  async function connect(key: string) {
    const check = await checkGeminiKey(key)
    if (!check.ok) return check.error ?? '키를 확인하지 못했어요.'
    update({ apiKey: key.trim() })
    setConnecting(false)
    setError(null)
    return null
  }

  // 이미 물어본 질문은 빼고 3개씩
  const asked = new Set(messages.filter((m) => m.role === 'user').map((m) => m.text))
  const pool = (messages.length ? FOLLOW_UPS : STARTERS).filter((q) => !asked.has(q))
  const offset = messages.length ? Math.floor(messages.length / 2) % Math.max(pool.length, 1) : 0
  const suggestions = messages.length ? [...pool.slice(offset), ...pool.slice(0, offset)].slice(0, 3) : pool

  return (
    <div className="modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet modal__sheet chat" role="dialog" aria-label={`${MASCOT_NAME}와 대화`}>
        <div className="sheet__grab" />
        <div className="sheet__head chat__head">
          <MoaFace size={44} className="chat__face" />
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
            <div className="chat__setting">
              <span>
                <b>내 Gemini 키</b>
                <span className="muted">
                  {apiKey ? `연결됨 · ${apiKey.slice(0, 4)}…${apiKey.slice(-4)}` : serverKey ? '연결 안 함 (앱 기본 키 사용 중)' : '연결 안 됨'}
                </span>
              </span>
              {apiKey ? (
                <button className="link link--danger" onClick={() => update({ apiKey: '' })}>
                  연결 끊기
                </button>
              ) : (
                <button
                  className="link"
                  onClick={() => {
                    setConnecting(true)
                    setSettings(false)
                  }}
                >
                  연결하기
                </button>
              )}
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
            안녕하세요! 저는 {MASCOT_NAME}예요. 앱에 있는 내 포트폴리오를 보고 같이 고민해 드릴게요.{' '}
            {needsKey ? '먼저 아래에서 Gemini 키를 연결해 주세요.' : '아래 질문을 눌러도 되고, 편하게 물어봐도 돼요.'}
          </Bubble>
          {messages.map((m, i) => (
            <Bubble key={i} who={m.role}>
              {m.role === 'model' ? renderText(m.text) : m.text}
            </Bubble>
          ))}
          {busy && (
            <Bubble who="model">
              {partial ? (
                renderText(partial)
              ) : (
                <span className="chat__typing" aria-label="생각하는 중">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </Bubble>
          )}
          {error && !(error.code === 'nokey' && needsKey) && (
            <div className="chat__error">
              <p>{error.text}</p>
              {error.code === 'badkey' && apiKey && (
                <button className="link" onClick={() => setConnecting(true)}>
                  키 다시 연결하기
                </button>
              )}
              {error.code === 'password' && (
                <form
                  className="chat__pw"
                  onSubmit={(e) => {
                    e.preventDefault()
                    update({ password: pw })
                    ask(input, pw)
                  }}
                >
                  <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="대화 비밀번호" aria-label="대화 비밀번호" />
                  <button className="btn btn--primary btn--sm">확인</button>
                </form>
              )}
              {error.code !== 'password' && error.code !== 'nokey' && error.code !== 'badkey' && (
                <p className="muted">질문은 입력칸에 그대로 있어요. 잠시 뒤 다시 보내 주세요.</p>
              )}
            </div>
          )}
          {needsKey && (
            <KeyConnect
              reason={!apiKey && serverKey === false ? 'none' : 'manual'}
              onConnect={connect}
              onCancel={connecting ? () => setConnecting(false) : undefined}
            />
          )}
        </div>

        {!busy && !needsKey && (
          <div className="chat__chips">
            {suggestions.map((q) => (
              <button key={q} className="chip chat__chip" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {!needsKey && (
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
        )}
        <p className="chat__note">{MASCOT_NAME}의 답은 참고용이에요. 투자 결정은 직접 판단해 주세요.</p>
      </div>
    </div>
  )
}

/** 내 Gemini 키 연결 안내 + 입력 */
function KeyConnect({
  reason,
  onConnect,
  onCancel,
}: {
  reason: 'none' | 'manual'
  onConnect: (key: string) => Promise<string | null>
  onCancel?: () => void
}) {
  const [key, setKey] = useState('')
  const [checking, setChecking] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="card card--soft key-connect">
      <b className="key-connect__title">내 Gemini 키 연결하기</b>
      <p className="muted">
        {reason === 'none' ? '모아와 대화하려면 Google Gemini 키가 필요해요. ' : ''}
        무료로 1분이면 만들 수 있어요.
      </p>
      <ol className="key-connect__steps">
        <li>아래 버튼으로 Google AI Studio를 열고 구글 계정으로 로그인</li>
        <li>
          <b>Create API key</b>(API 키 만들기) 누르기
        </li>
        <li>만들어진 키(AIza…)를 복사해서 아래에 붙여넣기</li>
      </ol>
      <a className="btn btn--ghost btn--sm key-connect__open" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
        Google AI Studio 열기 ↗
      </a>
      <form
        className="chat__pw"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!key.trim() || checking) return
          setChecking(true)
          setErr(await onConnect(key))
          setChecking(false)
        }}
      >
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza로 시작하는 키"
          aria-label="Gemini API 키"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button className="btn btn--primary btn--sm" disabled={!key.trim() || checking}>
          {checking ? '확인 중' : '연결'}
        </button>
      </form>
      {err && <p className="key-connect__err">{err}</p>}
      <p className="key-connect__note">키는 이 폰에만 저장되고 Google로만 보내져요. 결제 정보를 등록하지 않으면 돈이 들지 않아요.</p>
      {onCancel && (
        <button className="link" onClick={onCancel}>
          닫기
        </button>
      )}
    </div>
  )
}

function Bubble({ who, children }: { who: 'user' | 'model'; children: ReactNode }) {
  return (
    <div className={`chat__row chat__row--${who}`}>
      {who === 'model' && <MoaFace size={30} className="chat__avatar" />}
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
