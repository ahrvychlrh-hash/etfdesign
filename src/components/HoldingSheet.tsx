import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Account, EtfStats, Holding } from '../lib/types'
import { fetchQuote, loadKrEtfs, searchRemote, type KrEtfRow, type SearchItem } from '../lib/api'
import { displayTicker, isForeign, searchPresets } from '../lib/presets'
import { ASSET_CLASSES, expectedBreakdown } from '../lib/expected'
import { ICONS } from '../lib/characters'
import { groupDigits, parseNumber, won, wonShort } from '../lib/format'
import { ConfirmButton } from './ui'

interface Props {
  initial?: Holding
  accounts: Account[]
  defaultAccountId: string
  reinvest: boolean
  onSave: (h: Holding) => void
  onDelete?: () => void
  onClose: () => void
  onManageAccounts: () => void
}

interface Picked {
  symbol: string
  name: string
}

export function HoldingSheet(props: Props) {
  const { initial, onClose } = props
  const [picked, setPicked] = useState<Picked | null>(initial ? { symbol: initial.symbol, name: initial.name } : null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet modal__sheet" role="dialog" aria-label={initial ? 'ETF 수정' : 'ETF 추가'}>
        <div className="sheet__grab" />
        {picked ? (
          <HoldingForm key={picked.symbol} {...props} picked={picked} onBack={initial ? undefined : () => setPicked(null)} />
        ) : (
          <EtfSearch onPick={setPicked} onClose={onClose} />
        )}
      </div>
    </div>
  )
}

/* ---------------- 1단계: 검색 ---------------- */

function EtfSearch({ onPick, onClose }: { onPick: (p: Picked) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [kr, setKr] = useState<KrEtfRow[] | null>(null)
  const [krError, setKrError] = useState(false)
  const [remote, setRemote] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadKrEtfs()
      .then(setKr)
      .catch(() => setKrError(true))
  }, [])

  useEffect(() => {
    const term = q.trim()
    // Yahoo 검색은 해외 ETF용 — 한글이나 국내 코드 형태는 국내 목록에서만 찾음
    if (term.length < 2 || /[가-힣]/.test(term) || /^\d/.test(term)) {
      setRemote([])
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      searchRemote(term)
        .then(setRemote)
        .catch(() => setRemote([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const local = searchPresets(q, kr ?? [])
  const seen = new Set(local.map((p) => p.symbol))
  const extra = remote.filter((r) => !seen.has(r.symbol))
  const code = q.trim().toUpperCase()
  const directKr = /^[0-9][0-9A-Z]{5}$/.test(code) && !seen.has(`${code}.KS`)

  return (
    <>
      <div className="sheet__head">
        <h2>어떤 ETF를 가지고 있나요?</h2>
        <button className="icon-btn" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
      <div className="field field--search">
        <img src={ICONS.search} alt="" width={20} height={20} />
        <input
          autoFocus
          placeholder="이름·종목코드 (예: TIME 코스닥, 360750, SCHD)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <p className="results__count">
        {kr ? `국내 상장 ETF ${kr.length.toLocaleString('ko-KR')}개 + 해외 ETF 검색` : krError ? '국내 ETF 목록을 불러오지 못했어요' : '국내 ETF 목록 불러오는 중…'}
      </p>
      <ul className="results">
        {directKr && <ResultRow symbol={`${code}.KS`} name={`종목코드 ${code}`} sub="국내" onPick={onPick} />}
        {local.map((p) => (
          <ResultRow key={p.symbol} symbol={p.symbol} name={p.name} sub={p.market} onPick={onPick} />
        ))}
        {extra.map((r) => (
          <ResultRow key={r.symbol} symbol={r.symbol} name={r.name} sub={r.exchange} onPick={onPick} />
        ))}
        {loading && <li className="results__msg">해외 ETF 검색 중…</li>}
        {!loading && q && local.length === 0 && extra.length === 0 && !directKr && (
          <li className="results__msg">결과가 없어요. 다른 이름이나 종목코드로 검색해 보세요.</li>
        )}
      </ul>
    </>
  )
}

function ResultRow({ symbol, name, sub, onPick }: { symbol: string; name: string; sub: string; onPick: (p: Picked) => void }) {
  return (
    <li>
      <button className="result" onClick={() => onPick({ symbol, name })}>
        <span className="list__main">
          {isForeign(symbol) ? (
            <>
              <b>{symbol}</b>
              <span className="muted">
                {name} · {sub}
              </span>
            </>
          ) : (
            <>
              <b>{name}</b>
              <span className="muted">
                {displayTicker(symbol)} · {sub}
              </span>
            </>
          )}
        </span>
        <span className="chev">›</span>
      </button>
    </li>
  )
}

/* ---------------- 2단계: 계좌·수량·금액 입력 ---------------- */

function HoldingForm({
  picked,
  initial,
  accounts,
  defaultAccountId,
  reinvest,
  onBack,
  onSave,
  onDelete,
  onClose,
  onManageAccounts,
}: Props & { picked: Picked; onBack?: () => void }) {
  const [accountId, setAccountId] = useState(initial?.accountId ?? defaultAccountId)
  const [qty, setQty] = useState(initial?.quantity ?? 0)
  const [invested, setInvested] = useState(initial?.invested ?? 0)
  const [price, setPrice] = useState(initial?.currentPrice ?? 0)
  const [mode, setMode] = useState<Holding['priceMode']>(initial?.priceMode ?? 'auto')
  const [stats, setStats] = useState<EtfStats | undefined>(initial?.stats)
  const [name, setName] = useState(initial?.name ?? picked.name)
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  // 수량을 바꿀 때 평균가와 투자금 중 마지막에 직접 입력한 쪽을 유지
  const costAnchor = useRef<'avg' | 'invested'>('invested')
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    let alive = true
    fetchQuote(picked.symbol)
      .then((q) => {
        if (!alive) return
        setStats(q.stats)
        setLivePrice(q.price)
        if (!/^종목코드 /.test(q.name)) setName((n) => (n.startsWith('종목코드 ') || !n ? q.name : n))
        setStatus('ok')
        if (modeRef.current === 'auto') setPrice(q.price)
      })
      .catch(() => {
        if (!alive) return
        setStatus('error')
        if (!initial) setMode('manual')
      })
    return () => {
      alive = false
    }
  }, [picked.symbol, initial])

  const avg = qty > 0 ? invested / qty : 0
  const evaluation = qty * price
  const valid = qty > 0 && invested > 0 && price > 0
  const gain = evaluation - invested
  const exp = expectedBreakdown({ name, symbol: picked.symbol, currentPrice: price || livePrice || 0, stats }, reinvest)
  const yearlyDiv = qty * (stats?.divPerShare ?? 0)

  function changeQty(n: number) {
    if (costAnchor.current === 'avg') setInvested(Math.round(avg * n))
    setQty(n)
  }
  function changeAvg(n: number) {
    costAnchor.current = 'avg'
    setInvested(n * qty)
  }
  function changeInvested(n: number) {
    costAnchor.current = 'invested'
    setInvested(n)
  }
  function changeEvaluation(n: number) {
    setMode('manual')
    if (qty > 0) setPrice(n / qty)
  }
  function backToLive() {
    if (livePrice == null) return
    setMode('auto')
    setPrice(livePrice)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSave({
        id: initial?.id ?? crypto.randomUUID(),
        accountId,
        symbol: picked.symbol,
        name,
        quantity: qty,
        invested,
        currentPrice: price,
        priceMode: mode,
        stats,
    })
  }

  return (
    <form onSubmit={submit}>
      <div className="sheet__head">
        {onBack ? (
          <button type="button" className="icon-btn" onClick={onBack} aria-label="다시 검색">
            ‹
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>

      <div className="etf-head">
        <span className="list__main">
          <span className="muted">
            {isForeign(picked.symbol) ? name : displayTicker(picked.symbol)} · {ASSET_CLASSES[exp.assetClass].label}
          </span>
          <b className="etf-head__name">{isForeign(picked.symbol) ? picked.symbol : name}</b>
        </span>
        <span className="etf-head__price">
          <span className="muted">현재가</span>
          <b>{status === 'loading' ? '불러오는 중…' : livePrice != null ? won(livePrice) : '—'}</b>
          {stats && stats.currency !== 'KRW' && status === 'ok' && (
            <span className="muted">
              {stats.nativePrice.toFixed(2)} {stats.currency} · 환율 {stats.fx.toFixed(0)}
            </span>
          )}
        </span>
      </div>

      {status === 'error' && <p className="alert">시세를 불러오지 못했어요. 평가금을 직접 입력해 주세요.</p>}

      {status !== 'loading' && <ExpectedCard exp={exp} reinvest={reinvest} />}

      <div className="form-item form-item--full">
        <span className="form-item__label">계좌</span>
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
          <button type="button" className="chip chip--ghost" onClick={onManageAccounts}>
            + 계좌 관리
          </button>
        </div>
      </div>

      <div className="form-grid">
        <NumberField label="보유 주식수" suffix="주" value={qty} onChange={changeQty} autoFocus={!initial} />
        <NumberField label="투자금 (총 매입금액)" suffix="원" value={invested} onChange={changeInvested} />
        <NumberField
          label="평균매입가"
          suffix="원"
          value={Math.round(avg)}
          onChange={changeAvg}
          hint={qty > 0 && invested > 0 ? '투자금 ÷ 주식수로 자동 계산' : '투자금을 넣으면 자동 계산돼요'}
        />
        <NumberField
          label="평가금"
          suffix="원"
          value={Math.round(evaluation)}
          onChange={changeEvaluation}
          hint={
            mode === 'auto' ? (
              '현재가 × 주식수로 자동 계산'
            ) : livePrice != null ? (
              <button type="button" className="link" onClick={backToLive}>
                현재가로 되돌리기
              </button>
            ) : (
              '직접 입력한 금액'
            )
          }
        />
      </div>

      {valid && (
        <div className="callout callout--rows">
          <div>
            <span>평가손익</span>
            <b className={gain > 0 ? 'tone-up' : gain < 0 ? 'tone-down' : ''}>
              {gain >= 0 ? '+' : ''}
              {won(gain)} ({((gain / invested) * 100).toFixed(2)}%)
            </b>
          </div>
          <div>
            <span>연 예상 배당금</span>
            <b>{yearlyDiv > 0 ? `${wonShort(yearlyDiv)} (세후 ${wonShort(yearlyDiv * 0.846)})` : '배당 없음'}</b>
          </div>
        </div>
      )}

      <div className="sheet__actions">
        {onDelete && (
          <ConfirmButton
            className="btn btn--danger"
            label="삭제"
            question="이 ETF를 삭제할까요?"
            confirmLabel="삭제"
            onConfirm={onDelete}
          />
        )}
        <button type="submit" className="btn btn--primary btn--xl" disabled={!valid}>
          저장하기
        </button>
      </div>
    </form>
  )
}

function ExpectedCard({ exp, reinvest }: { exp: ReturnType<typeof expectedBreakdown>; reinvest: boolean }) {
  return (
    <div className="exp">
      <div className="exp__top">
        <span>기대 연수익률 {reinvest ? '(배당 재투자)' : '(가격 상승분만)'}</span>
        <b>{exp.rate.toFixed(1)}%</b>
      </div>
      <p className="exp__why">
        {exp.source === 'etf' && (
          <>
            이 ETF의 실제 {exp.basisYears}년 연평균 <b>{exp.basisRate.toFixed(1)}%</b>
          </>
        )}
        {exp.source === 'index' && (
          <>
            {exp.etfYears > 0 ? `상장 ${exp.etfYears}년이라 ` : '신규 상장이라 '}기초지수 <b>{exp.indexLabel}</b>의{' '}
            {Math.round(exp.basisYears)}년 연평균 <b>{exp.basisRate.toFixed(1)}%</b> 적용
          </>
        )}
        {exp.source === 'anchor' && (
          <>
            {ASSET_CLASSES[exp.assetClass].label} 장기 평균 <b>{exp.basisRate}%</b> 적용 (기초지수 데이터 없음)
          </>
        )}
        {exp.total !== exp.basisRate && <> → 최대 15%로 제한</>}
        {!reinvest && exp.divYield > 0 && <> − 배당수익률 {exp.divYield.toFixed(1)}%</>}
      </p>
    </div>
  )
}

function NumberField(props: {
  label: string
  suffix: string
  value: number
  onChange: (n: number) => void
  hint?: ReactNode
  autoFocus?: boolean
}) {
  return (
    <label className="form-item">
      <span className="form-item__label">{props.label}</span>
      <div className="field">
        <input
          inputMode="numeric"
          placeholder="0"
          autoFocus={props.autoFocus}
          value={groupDigits(props.value)}
          onChange={(e) => props.onChange(parseNumber(e.target.value))}
        />
        <span className="field__suffix">{props.suffix}</span>
      </div>
      {props.hint && <span className="form-item__hint">{props.hint}</span>}
    </label>
  )
}
