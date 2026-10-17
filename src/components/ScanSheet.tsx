import { useEffect, useRef, useState } from 'react'
import type { Account, Holding } from '../lib/types'
import { fetchQuote, loadKrEtfs, scanScreenshots, type Quote } from '../lib/api'
import { matchScanned, scannedNumbers, type ScanMatch } from '../lib/scan'
import { displayTicker, isForeign, unitOf } from '../lib/presets'
import { won } from '../lib/format'
import { ICONS } from '../lib/characters'

interface Props {
  accounts: Account[]
  holdings: Holding[]
  defaultAccountId: string
  /** 바뀐 ETF와 새로 추가할 ETF */
  onApply: (updated: Holding[], added: Holding[]) => void
  onClose: () => void
}

type Step = { kind: 'pick' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'review'; matches: ScanMatch[] }

const MAX_FILES = 6

export function ScanSheet({ accounts, holdings, defaultAccountId, onApply, onClose }: Props) {
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [files, setFiles] = useState<File[]>([])
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function scan() {
    setStep({ kind: 'loading' })
    try {
      const [rows, kr] = await Promise.all([scanScreenshots(files), loadKrEtfs().catch(() => [])])
      if (!rows.length) {
        setStep({ kind: 'error', message: '캡처에서 보유 종목을 찾지 못했어요. 종목 목록이 보이는 화면으로 다시 올려주세요.' })
        return
      }
      setStep({ kind: 'review', matches: matchScanned(rows, holdings.filter((h) => h.accountId === accountId), kr) })
    } catch (e) {
      setStep({ kind: 'error', message: e instanceof Error ? e.message : '읽지 못했어요' })
    }
  }

  const account = accounts.find((a) => a.id === accountId)

  return (
    <div className="modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet modal__sheet" role="dialog" aria-label="캡처로 입력">
        <div className="sheet__grab" />
        <div className="sheet__head">
          <h2>{step.kind === 'review' ? '읽은 내용 확인' : '증권 앱 캡처로 입력'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {step.kind === 'review' ? (
          <Review
            matches={step.matches}
            accountId={accountId}
            accountName={account?.name ?? ''}
            holdings={holdings}
            onBack={() => setStep({ kind: 'pick' })}
            onApply={onApply}
          />
        ) : (
          <>
            <p className="hint hint--top">
              증권 앱의 잔고(보유 종목) 화면을 캡처해서 올리면 수량·투자금·평가금을 읽어서 채워드려요. 한 계좌씩 올려주세요.
            </p>

            <div className="form-item form-item--full">
              <span className="form-item__label">어느 계좌 캡처인가요?</span>
              <div className="chips chips--wrap">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`chip chip--select ${a.id === accountId ? 'is-on' : ''}`}
                    onClick={() => setAccountId(a.id)}
                  >
                    {a.name}
                    {a.kind !== '일반' && <small> · {a.kind}</small>}
                  </button>
                ))}
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                setFiles([...(e.target.files ?? [])].slice(0, MAX_FILES))
                setStep({ kind: 'pick' })
              }}
            />
            <button type="button" className="scan-drop" onClick={() => inputRef.current?.click()}>
              <img src={ICONS.camera} alt="" className="icon3d icon3d--sm" />
              {files.length ? (
                <span>
                  <b>캡처 {files.length}장 선택됨</b>
                  <span className="muted">눌러서 다시 고르기</span>
                </span>
              ) : (
                <span>
                  <b>캡처 이미지 고르기</b>
                  <span className="muted">스크롤해서 여러 장 찍었다면 최대 {MAX_FILES}장까지 함께 올려주세요</span>
                </span>
              )}
            </button>

            {step.kind === 'error' && <p className="alert">{step.message}</p>}

            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--primary btn--xl"
                disabled={!files.length || step.kind === 'loading'}
                onClick={scan}
              >
                {step.kind === 'loading' ? '캡처 읽는 중… (10~30초)' : '읽어오기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- 확인 후 적용 ---------------- */

function Review({
  matches,
  accountId,
  accountName,
  holdings,
  onBack,
  onApply,
}: {
  matches: ScanMatch[]
  accountId: string
  accountName: string
  holdings: Holding[]
  onBack: () => void
  onApply: Props['onApply']
}) {
  // 새로 추가할 종목의 시세·환율
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({})
  const [checked, setChecked] = useState<boolean[]>(() => matches.map((m) => !!m.symbol))

  useEffect(() => {
    const need = matches.filter((m) => m.symbol && (!m.target || m.row.currency === 'USD')).map((m) => m.symbol!)
    for (const s of new Set(need)) {
      fetchQuote(s)
        .then((q) => setQuotes((p) => ({ ...p, [s]: q })))
        .catch(() => setQuotes((p) => ({ ...p, [s]: null })))
    }
  }, [matches])

  // 달러 금액은 내 해외 ETF의 환율, 없으면 새로 받은 시세의 환율로 원화 환산
  const knownFx = holdings.find((h) => h.stats?.currency === 'USD')?.stats?.fx ?? null
  const items = matches.map((m) => {
    const fx = m.row.currency === 'USD' ? (m.target?.stats?.fx ?? (m.symbol && quotes[m.symbol]?.stats.fx) ?? knownFx) : 1
    const n = scannedNumbers(m.row, fx || null)
    const quote = m.symbol ? quotes[m.symbol] : undefined
    const qty = n.qty ?? m.target?.quantity ?? null
    // 새 종목은 수량과 투자금(없으면 평가금)이 있어야 추가 가능
    const ready = !!m.symbol && (m.target ? n.qty != null || n.invested != null || n.value != null : qty != null && (n.invested ?? n.value) != null)
    return { m, n, quote, qty, ready }
  })
  const count = items.filter((it, i) => checked[i] && it.ready).length

  function apply() {
    const updated: Holding[] = []
    const added: Holding[] = []
    items.forEach(({ m, n, quote, qty, ready }, i) => {
      if (!checked[i] || !ready || !qty) return
      if (m.target) {
        const h = m.target
        updated.push({
          ...h,
          quantity: qty,
          invested: n.invested ?? (n.qty != null ? Math.round((h.invested / h.quantity) * qty) : h.invested),
          currentPrice: n.value != null ? n.value / qty : h.currentPrice,
        })
      } else {
        added.push({
          id: crypto.randomUUID(),
          accountId,
          symbol: m.symbol!,
          name: quote?.name && !/^종목코드 /.test(quote.name) ? quote.name : m.name,
          quantity: qty,
          invested: n.invested ?? n.value!,
          currentPrice: n.value != null ? n.value / qty : (quote?.price ?? 0),
          priceMode: 'auto',
          stats: quote?.stats,
        })
      }
    })
    onApply(updated, added)
  }

  return (
    <>
      <p className="hint hint--top">
        <b>{accountName}</b> 계좌에 적용해요. 체크한 종목만 바뀌고, 캡처에 없는 종목은 그대로 둬요.
      </p>
      <ul className="scan-list">
        {items.map(({ m, n, qty, ready }, i) => (
          <li key={i} className={`scan-row ${ready ? '' : 'is-off'}`}>
            <label className="scan-row__head">
              <input
                type="checkbox"
                checked={checked[i] && ready}
                disabled={!ready}
                onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              <span className="list__main">
                <b>{m.symbol && isForeign(m.symbol) ? m.symbol : m.name}</b>
                <span className="muted">
                  {m.symbol ? displayTicker(m.symbol) : m.row.name}
                  {m.row.currency === 'USD' && ' · 달러 금액 원화 환산'}
                </span>
              </span>
              <span className={`tag tag--xs ${m.target ? 'tag--blue' : m.symbol ? 'tag--up' : 'tag--warn'}`}>
                {m.target ? '업데이트' : m.symbol ? '새로 추가' : '종목 못 찾음'}
              </span>
            </label>
            {m.symbol && (
              <dl className="scan-row__nums">
                <Num label="수량" before={m.target?.quantity} after={qty} unit={unitOf(m.symbol)} />
                <Num label="투자금" before={m.target?.invested} after={n.invested} money />
                <Num label="평가금" before={m.target ? m.target.quantity * m.target.currentPrice : undefined} after={n.value} money />
              </dl>
            )}
            {!ready && m.symbol && <p className="hint hint--sm">수량이나 금액을 읽지 못해서 건너뛰어요.</p>}
            {!m.symbol && <p className="hint hint--sm">국내 ETF 목록에서 찾지 못했어요. ETF 추가로 직접 넣어주세요.</p>}
          </li>
        ))}
      </ul>
      <p className="hint hint--sm">AI가 읽은 값이라 틀릴 수 있어요. 적용하기 전에 숫자를 한 번 확인해 주세요.</p>
      <div className="sheet__actions">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          다시 올리기
        </button>
        <button type="button" className="btn btn--primary btn--xl" disabled={!count} onClick={apply}>
          {count}개 적용하기
        </button>
      </div>
    </>
  )
}

function Num({
  label,
  before,
  after,
  unit = '',
  money,
}: {
  label: string
  before?: number
  after: number | null
  unit?: string
  money?: boolean
}) {
  const fmt = (v: number) => (money ? won(v) : `${v.toLocaleString('ko-KR')}${unit}`)
  const changed = before != null && after != null && Math.round(before) !== Math.round(after)
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {after == null ? (
          <span className="muted">{before != null ? `${fmt(before)} (그대로)` : '—'}</span>
        ) : changed ? (
          <>
            <s className="muted">{fmt(before!)}</s> → <b>{fmt(after)}</b>
          </>
        ) : (
          <b>{fmt(after)}</b>
        )}
      </dd>
    </div>
  )
}
