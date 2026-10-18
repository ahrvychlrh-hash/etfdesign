import { useRef, useState } from 'react'
import type { AppState } from '../lib/types'
import { backupNow, exportState, importState, listBackups, parseState } from '../lib/storage'
import { ConfirmButton, Section } from './ui'

interface Props {
  state: AppState
  onImport: (s: AppState) => void
}

function fileName() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `etf-design-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`
}

function backupLabel(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 데이터 백업 — 파일로 내보내기·불러오기, 자동 백업에서 복원 */
export function BackupSection({ state, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, setPending] = useState<AppState | null>(null)
  const [showAuto, setShowAuto] = useState(false)
  const backups = showAuto ? listBackups() : []

  async function exportFile() {
    const text = exportState(state)
    const file = new File([text], fileName(), { type: 'application/json' })
    try {
      // 휴대폰은 공유 창으로 (파일 앱·카톡·메일 등에 저장)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ETF DESIGN 백업' })
        setMsg({ ok: true, text: '백업 파일을 보냈어요. 안전한 곳에 저장해 두세요.' })
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMsg({ ok: true, text: `${file.name} 파일로 저장했어요.` })
  }

  async function readFile(f: File) {
    try {
      const next = importState(await f.text())
      setPending(next)
      setMsg(null)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '백업 파일을 읽지 못했어요' })
    }
  }

  function apply(next: AppState, text: string) {
    // 바꾸기 전 데이터도 백업으로 남겨서 되돌릴 수 있게
    backupNow(state, '불러오기 전')
    onImport(next)
    setPending(null)
    setShowAuto(false)
    setMsg({ ok: true, text })
  }

  return (
    <Section title="데이터 백업">
      <div className="card backup">
        <p className="hint hint--sm">
          입력한 정보는 이 기기의 브라우저에만 저장돼요. 폰을 바꾸거나 브라우저 데이터를 지우기 전에 파일로 백업해 두세요. 하루에
          한 번 그날 첫 상태와, 불러오기·복원·초기화 직전 상태도 이 기기 안에 자동으로 백업해요(최근 10개).
        </p>
        <div className="backup__btns">
          <button className="btn btn--primary btn--sm" onClick={exportFile}>
            파일로 내보내기
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            파일에서 불러오기
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setShowAuto((o) => !o)}>
            자동 백업에서 복원
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void readFile(f)
            e.target.value = ''
          }}
        />

        {pending && (
          <div className="backup__confirm">
            <p>
              백업 파일에 ETF {pending.holdings.length}개, 계좌 {pending.accounts.length}개가 있어요. 지금 데이터를 이 내용으로 바꿀까요?
            </p>
            <div className="row-end">
              <button className="btn btn--ghost btn--sm" onClick={() => setPending(null)}>
                취소
              </button>
              <button className="btn btn--primary btn--sm" onClick={() => apply(pending, '백업 파일로 복원했어요.')}>
                바꾸기
              </button>
            </div>
          </div>
        )}

        {showAuto && (
          <ul className="backup__list">
            {backups.length === 0 && <li className="muted">아직 자동 백업이 없어요.</li>}
            {backups.map((b) => {
              let summary = ''
              let parsed: AppState | null = null
              try {
                parsed = parseState(JSON.parse(b.data))
                summary = `ETF ${parsed.holdings.length}개 · 계좌 ${parsed.accounts.length}개`
              } catch {
                summary = '읽을 수 없는 백업'
              }
              return (
                <li key={b.at}>
                  <span className="list__main">
                    <b>
                      {backupLabel(b.at)}
                      {b.reason && <span className="tag tag--xs">{b.reason}</span>}
                    </b>
                    <span className="muted">{summary}</span>
                  </span>
                  {parsed && (
                    <ConfirmButton
                      className="link"
                      label="복원"
                      question="이 백업으로 바꿀까요?"
                      confirmLabel="복원"
                      onConfirm={() => apply(parsed, `${backupLabel(b.at)} 백업으로 복원했어요.`)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {msg && <p className={`hint hint--sm ${msg.ok ? '' : 'tone-down'}`}>{msg.text}</p>}
      </div>
    </Section>
  )
}
