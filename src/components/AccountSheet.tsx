import { useEffect, useState } from 'react'
import { ACCOUNT_KINDS, type Account, type AccountKind } from '../lib/types'
import { ConfirmButton } from './ui'

interface Props {
  accounts: Account[]
  counts: Map<string, number>
  onChange: (accounts: Account[]) => void
  /** 계좌 삭제 — 그 계좌의 ETF는 남은 첫 계좌로 옮김 */
  onDelete: (id: string) => void
  onClose: () => void
}

export function AccountSheet({ accounts, counts, onChange, onDelete, onClose }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('일반')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function add() {
    const n = name.trim()
    if (!n) return
    onChange([...accounts, { id: crypto.randomUUID(), name: n, kind }])
    setName('')
    setKind('일반')
  }

  const patch = (id: string, p: Partial<Account>) => onChange(accounts.map((a) => (a.id === id ? { ...a, ...p } : a)))

  return (
    <div className="modal modal--top" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet modal__sheet" role="dialog" aria-label="계좌 관리">
        <div className="sheet__grab" />
        <div className="sheet__head">
          <h2>계좌 관리</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <p className="hint hint--top">증권사·계좌별로 ETF를 묶어서 볼 수 있어요. (예: 키움 ISA, 미래에셋 연금저축)</p>

        <ul className="acc-list">
          {accounts.map((a) => (
            <li key={a.id} className="acc">
              <div className="field">
                <input value={a.name} aria-label="계좌 이름" onChange={(e) => patch(a.id, { name: e.target.value })} />
                <span className="field__suffix">{counts.get(a.id) ?? 0}개</span>
              </div>
              <div className="acc__row">
                <div className="chips">
                  {ACCOUNT_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={`chip chip--select chip--sm ${a.kind === k ? 'is-on' : ''}`}
                      onClick={() => patch(a.id, { kind: k })}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                {accounts.length > 1 && (
                  <ConfirmButton
                    className="link link--danger"
                    label="삭제"
                    question={(counts.get(a.id) ?? 0) > 0 ? 'ETF는 다른 계좌로 옮겨요' : '삭제할까요?'}
                    confirmLabel="삭제"
                    onConfirm={() => onDelete(a.id)}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="acc acc--new">
          <span className="form-item__label">새 계좌 추가</span>
          <div className="field">
            <input
              placeholder="예: 키움 ISA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                // 한글 조합 중 Enter는 무시 (마지막 글자가 두 번 들어가는 문제 방지)
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                e.preventDefault()
                add()
              }}
            />
          </div>
          <div className="acc__row">
            <div className="chips">
              {ACCOUNT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip chip--select chip--sm ${kind === k ? 'is-on' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {k}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn--primary btn--sm" disabled={!name.trim()} onClick={add}>
              추가
            </button>
          </div>
        </div>

        <button type="button" className="btn btn--primary btn--xl sheet__done" onClick={onClose}>
          완료
        </button>
      </div>
    </div>
  )
}
