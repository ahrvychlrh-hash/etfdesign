import { useEffect, useState } from 'react'
import type { CryptoAsset } from '../lib/types'
import { fetchQuote, searchRemote, type SearchItem } from '../lib/api'
import { displayTicker, searchCrypto } from '../lib/presets'
import { ICONS } from '../lib/characters'
import { won, wonShort } from '../lib/format'
import { ConfirmButton, Section } from './ui'

interface Props {
  items: CryptoAsset[]
  onSave: (item: CryptoAsset) => void
  onDelete: (id: string) => void
}

const valueOf = (c: CryptoAsset) => c.quantity * c.price
const formatCoinQty = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 8 })
/** 코인 1개 가격 — 100원 미만인 코인은 소수점까지 */
const coinPrice = (p: number) =>
  p >= 100 ? won(p) : `${p.toLocaleString('ko-KR', { maximumSignificantDigits: 4 })}원`

/** 코인 현물 — 부동산처럼 총자산에는 더하지만 수익률·월별 기록·리밸런싱에서는 빠집니다. 평가금 = 보유 수량 × 현재가 */
export function CryptoSection({ items, onSave, onDelete }: Props) {
  // null: 닫힘, 'new': 새로 추가, 그 외: 수정 중인 id
  const [editing, setEditing] = useState<string | null>(null)
  const total = items.reduce((s, c) => s + valueOf(c), 0)

  return (
    <Section
      title="코인 (현물)"
      action={
        <button className="link" onClick={() => setEditing('new')}>
          + 추가
        </button>
      }
    >
      <div className="card">
        {items.length > 0 && (
          <div className="re-sum">
            <img src={ICONS.coin} alt="" className="icon3d icon3d--sm" />
            <span className="list__main">
              <span className="muted">코인 합계</span>
              <b>{won(total)}</b>
            </span>
          </div>
        )}

        {items.map((c) =>
          editing === c.id ? (
            <Form
              key={c.id}
              initial={c}
              onCancel={() => setEditing(null)}
              onSave={(x) => (onSave(x), setEditing(null))}
              onDelete={() => (onDelete(c.id), setEditing(null))}
            />
          ) : (
            <button key={c.id} className="re-item" onClick={() => setEditing(c.id)}>
              <CoinLogo symbol={c.symbol} />
              <span className="list__main">
                <b>{c.name}</b>
                <span className="muted">
                  {displayTicker(c.symbol)} · {formatCoinQty(c.quantity)}개
                </span>
              </span>
              <span className="list__num">
                <b>{wonShort(valueOf(c))}</b>
                <span className="muted">현재가 {coinPrice(c.price)}</span>
              </span>
              <span className="chev">›</span>
            </button>
          ),
        )}

        {editing === 'new' && <Form onCancel={() => setEditing(null)} onSave={(x) => (onSave(x), setEditing(null))} />}

        {items.length === 0 && editing !== 'new' && (
          <p className="muted re-empty">거래소에서 직접 산 비트코인·이더리움 등을 넣으면 총자산에 함께 보여드려요.</p>
        )}
        <p className="hint hint--sm">
          코인 현물은 총자산과 목표 달성률에는 더하지만, 수익률·월별 기록·리밸런싱에서는 빼고 계산해요. 평가금은 보유 수량 × 현재가(달러
          시세를 원화로 환산)예요.
        </p>
      </div>
    </Section>
  )
}

/** 코인 로고 — 업비트 → CoinCap 순서로 찾고, 둘 다 없으면 티커 첫 글자 */
function CoinLogo({ symbol }: { symbol: string }) {
  const ticker = displayTicker(symbol)
  const sources = [
    `https://static.upbit.com/logos/${ticker}.png`,
    `https://assets.coincap.io/assets/icons/${ticker.toLowerCase()}@2x.png`,
  ]
  const [i, setI] = useState(0)
  if (i >= sources.length) return <span className="coin-logo coin-logo--letter">{ticker.slice(0, 1)}</span>
  return <img className="coin-logo" src={sources[i]} alt="" loading="lazy" onError={() => setI((n) => n + 1)} />
}

function Form({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: CryptoAsset
  onSave: (c: CryptoAsset) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [picked, setPicked] = useState<{ symbol: string; name: string } | null>(
    initial ? { symbol: initial.symbol, name: initial.name } : null,
  )
  const [qtyText, setQtyText] = useState(initial ? String(initial.quantity) : '')
  const [price, setPrice] = useState<number | null>(initial?.price ?? null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (!picked) return
    let alive = true
    setStatus('loading')
    fetchQuote(picked.symbol)
      .then((q) => alive && (setPrice(q.price), setStatus('idle')))
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [picked])

  if (!picked) return <CoinSearch onPick={setPicked} onCancel={onCancel} />

  const qty = Number(qtyText) || 0
  const valid = qty > 0 && price != null && price > 0

  function changeQty(text: string) {
    const clean = text.replace(/[^\d.]/g, '')
    if (/^\d*\.?\d{0,8}$/.test(clean)) setQtyText(clean)
  }

  return (
    <div className="re-form">
      <div className="re-sum">
        <CoinLogo symbol={picked.symbol} />
        <span className="list__main">
          <span className="muted">{displayTicker(picked.symbol)} · 현재가</span>
          <b>{picked.name}</b>
        </span>
        <b>{status === 'loading' ? '불러오는 중…' : price ? won(price) : '—'}</b>
      </div>
      {status === 'error' && <p className="alert">시세를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      <label className="form-item">
        <span className="form-item__label">보유 수량</span>
        <div className="field">
          <input autoFocus inputMode="decimal" placeholder="0" value={qtyText} onChange={(e) => changeQty(e.target.value)} />
          <span className="field__suffix">개</span>
        </div>
        <span className="form-item__hint">{valid ? `평가금 ${won(qty * price)} (수량 × 현재가)` : '수량만 넣으면 현재가로 평가금을 계산해요'}</span>
      </label>
      <div className="row-end">
        {onDelete && (
          <ConfirmButton className="btn btn--danger btn--sm" label="삭제" question="삭제할까요?" confirmLabel="삭제" onConfirm={onDelete} />
        )}
        <button className="btn btn--ghost btn--sm" onClick={onCancel}>
          취소
        </button>
        <button
          className="btn btn--primary btn--sm"
          disabled={!valid}
          onClick={() =>
            onSave({
              id: initial?.id ?? crypto.randomUUID(),
              symbol: picked.symbol,
              name: picked.name,
              quantity: qty,
              price: price!,
              updatedAt: new Date().toISOString(),
            })
          }
        >
          저장
        </button>
      </div>
    </div>
  )
}

function CoinSearch({ onPick, onCancel }: { onPick: (p: { symbol: string; name: string }) => void; onCancel: () => void }) {
  const [q, setQ] = useState('')
  const [remote, setRemote] = useState<SearchItem[]>([])

  useEffect(() => {
    const term = q.trim()
    // 목록에 없는 코인은 영문 이름·티커로 Yahoo에서 찾음
    if (term.length < 2 || /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(term)) {
      setRemote([])
      return
    }
    const t = setTimeout(() => {
      searchRemote(term, 'crypto')
        .then(setRemote)
        .catch(() => setRemote([]))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const local = searchCrypto(q)
  const seen = new Set(local.map((p) => p.symbol))
  const extra = remote.filter((r) => !seen.has(r.symbol))

  return (
    <div className="re-form">
      <div className="field field--search">
        <img src={ICONS.search} alt="" width={20} height={20} />
        <input autoFocus placeholder="코인 이름·티커 (예: 비트코인, ETH)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="results">
        {local.map((p) => (
          <CoinRow key={p.symbol} symbol={p.symbol} name={p.name} onPick={onPick} />
        ))}
        {extra.map((r) => (
          <CoinRow key={r.symbol} symbol={r.symbol} name={r.name.replace(/ USD$/, '')} onPick={onPick} />
        ))}
        {q && local.length === 0 && extra.length === 0 && <li className="results__msg">결과가 없어요. 영문 티커로 검색해 보세요.</li>}
      </ul>
      <div className="row-end">
        <button className="btn btn--ghost btn--sm" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  )
}

function CoinRow({ symbol, name, onPick }: { symbol: string; name: string; onPick: (p: { symbol: string; name: string }) => void }) {
  return (
    <li>
      <button className="result" onClick={() => onPick({ symbol, name })}>
        <CoinLogo symbol={symbol} />
        <span className="list__main">
          <b>{name}</b>
          <span className="muted">{displayTicker(symbol)}</span>
        </span>
        <span className="chev">›</span>
      </button>
    </li>
  )
}
