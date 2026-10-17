import { useState } from 'react'
import type { RealEstate } from '../lib/types'
import { ICONS } from '../lib/characters'
import { won, wonShort } from '../lib/format'
import { MoneyInput } from './MoneyInput'
import { ConfirmButton, Section } from './ui'

interface Props {
  items: RealEstate[]
  onSave: (item: RealEstate) => void
  onDelete: (id: string) => void
}

/** 부동산 — 총자산에는 더하지만 수익률·월별 기록·리밸런싱에서는 빠집니다. */
export function RealEstateSection({ items, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<RealEstate | null>(null)
  const total = items.reduce((s, r) => s + r.value, 0)

  return (
    <Section
      title="부동산"
      action={
        <button className="link" onClick={() => setEditing({ id: '', name: '', value: 0 })}>
          + 추가
        </button>
      }
    >
      <div className="card">
        {items.length > 0 && (
          <div className="re-sum">
            <img src={ICONS.bank} alt="" className="icon3d icon3d--sm" />
            <span className="list__main">
              <span className="muted">부동산 합계</span>
              <b>{won(total)}</b>
            </span>
          </div>
        )}

        {items.map((r) =>
          editing?.id === r.id ? (
            <Form key={r.id} initial={editing} onCancel={() => setEditing(null)} onSave={(x) => (onSave(x), setEditing(null))} onDelete={() => (onDelete(r.id), setEditing(null))} />
          ) : (
            <button key={r.id} className="re-item" onClick={() => setEditing(r)}>
              <span className="list__main">
                <b>{r.name}</b>
                {r.memo && <span className="muted">{r.memo}</span>}
              </span>
              <b>{wonShort(r.value)}</b>
              <span className="chev">›</span>
            </button>
          ),
        )}

        {editing && !editing.id && <Form initial={editing} onCancel={() => setEditing(null)} onSave={(x) => (onSave(x), setEditing(null))} />}

        {items.length === 0 && !editing && (
          <p className="muted re-empty">아파트·오피스텔·토지 등 가진 부동산을 넣으면 총자산에 함께 보여드려요.</p>
        )}
        <p className="hint hint--sm">부동산은 총자산과 목표 달성률에는 더하지만, 수익률·월별 기록·리밸런싱에서는 빼고 계산해요.</p>
      </div>
    </Section>
  )
}

function Form({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: RealEstate
  onSave: (r: RealEstate) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [value, setValue] = useState(initial.value)
  const [memo, setMemo] = useState(initial.memo ?? '')
  const valid = name.trim() !== '' && value > 0

  return (
    <div className="re-form">
      <label className="form-item">
        <span className="form-item__label">이름</span>
        <div className="field">
          <input autoFocus placeholder="예: 우리집 아파트" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </label>
      <div className="form-item">
        <span className="form-item__label">현재 가치 (시세)</span>
        <MoneyInput id={`re-${initial.id || 'new'}`} value={value} onChange={setValue} />
      </div>
      <label className="form-item">
        <span className="form-item__label">메모 (선택)</span>
        <div className="field">
          <input placeholder="예: 2026년 10월 실거래가 기준" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
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
          onClick={() => onSave({ id: initial.id || crypto.randomUUID(), name: name.trim(), value, memo: memo.trim() || undefined })}
        >
          저장
        </button>
      </div>
    </div>
  )
}
