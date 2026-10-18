import { ACCOUNT_KINDS, type Account, type AppState, type CryptoAsset, type EtfStats, type Holding, type Profile } from './types'
import { isCrypto } from './presets'

const KEY = 'etf-planner/v1'
/** 하루 한 번 남기는 자동 백업 + 불러오기·복원·초기화 직전 백업 (최근 10개) */
const BACKUP_KEY = 'etf-planner/backups'
const MAX_BACKUPS = 10
/** 읽지 못한 데이터는 지우지 않고 이 이름으로 따로 보관 */
const BROKEN_PREFIX = 'etf-planner/broken-'

export const DEFAULT_ACCOUNT: Account = { id: 'default', name: '기본 계좌', kind: '일반' }

const empty: AppState = {
  profile: null,
  accounts: [DEFAULT_ACCOUNT],
  holdings: [],
  targets: {},
  snapshots: {},
  reinvests: [],
  realEstates: [],
  cryptos: [],
}

/** 잠깐 보유 ETF 목록에 코인을 넣던 버전의 데이터를 코인 칸으로 옮김 */
function holdingToCrypto(h: Holding): CryptoAsset {
  return {
    id: h.id,
    symbol: h.symbol,
    name: h.name,
    quantity: h.quantity,
    price: h.currentPrice,
    updatedAt: h.stats?.updatedAt,
  }
}

type OldHolding = Holding & { ticker?: string; avgPrice?: number; stats?: EtfStats & { divYield?: number } }

/** 이전 버전에서 저장한 데이터를 현재 형태로 맞춥니다. */
function migrateHolding(h: OldHolding, accountIds: Set<string>): Holding {
  const t = (h.ticker ?? '').toUpperCase()
  const symbol = h.symbol ?? (/^[0-9A-Z]{6}$/.test(t) && /\d/.test(t) ? `${t}.KS` : t)
  return {
    id: h.id,
    accountId: h.accountId && accountIds.has(h.accountId) ? h.accountId : DEFAULT_ACCOUNT.id,
    symbol,
    name: h.name,
    quantity: h.quantity,
    invested: h.invested ?? (h.avgPrice ?? 0) * h.quantity,
    currentPrice: h.currentPrice,
    priceMode: h.priceMode ?? 'auto',
    // 예전 형식의 성과 데이터는 버리고 다시 불러옴 (30년 기준으로 바뀜)
    stats: h.stats && 'divPerShare' in h.stats ? h.stats : undefined,
  }
}

/** 예전 버전의 현금·기본 수익률·캐릭터 선택 값은 더 이상 쓰지 않음 */
function migrateProfile(p: Profile | null | undefined): Profile | null {
  if (!p) return null
  return { age: p.age, target: p.target, monthly: p.monthly, reinvest: p.reinvest ?? true, createdAt: p.createdAt }
}

/** 저장된 값(또는 백업 파일)을 앱 데이터로 바꿉니다. 형식이 맞지 않으면 오류를 냅니다. */
export function parseState(value: unknown): AppState {
  if (!value || typeof value !== 'object') throw new Error('데이터 형식이 맞지 않아요')
  const parsed = value as Partial<AppState>
  if (!Array.isArray(parsed.accounts) && !Array.isArray(parsed.holdings)) throw new Error('데이터 형식이 맞지 않아요')
  // 없어진 계좌 종류('코인' 등)는 일반으로
  const accounts = (parsed.accounts?.length ? parsed.accounts : [DEFAULT_ACCOUNT]).map((a) =>
    (ACCOUNT_KINDS as readonly string[]).includes(a.kind) ? a : { ...a, kind: '일반' as const },
  )
  const ids = new Set(accounts.map((a) => a.id))
  const holdings = ((parsed.holdings ?? []) as OldHolding[]).map((h) => migrateHolding(h, ids))
  return {
    profile: migrateProfile(parsed.profile),
    accounts,
    holdings: holdings.filter((h) => !isCrypto(h.symbol)),
    targets: parsed.targets ?? {},
    snapshots: parsed.snapshots ?? {},
    reinvests: parsed.reinvests ?? [],
    realEstates: parsed.realEstates ?? [],
    cryptos: [...(parsed.cryptos ?? []), ...holdings.filter((h) => isCrypto(h.symbol)).map(holdingToCrypto)],
  }
}

export function loadState(): AppState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return empty
  }
  if (!raw) return empty
  try {
    return parseState(JSON.parse(raw))
  } catch {
    // 읽지 못한 데이터를 빈 상태로 덮어쓰지 않게 따로 보관하고, 자동 백업이 있으면 그것으로 시작
    try {
      localStorage.setItem(BROKEN_PREFIX + Date.now(), raw)
    } catch {
      // noop
    }
    for (const b of listBackups()) {
      try {
        return parseState(JSON.parse(b.data))
      } catch {
        // 다음 백업으로
      }
    }
    return empty
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 저장 공간을 쓸 수 없는 환경(시크릿 모드 등)에서는 메모리에만 유지
    return
  }
  autoBackup(state)
}

export function clearState() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // noop
  }
}

export function emptyState(): AppState {
  return { ...empty, accounts: [DEFAULT_ACCOUNT] }
}

/* ---------------- 백업 ---------------- */

export interface Backup {
  /** 백업한 시각 (ISO) */
  at: string
  /** 저장한 데이터 (JSON 문자열) */
  data: string
  /** 왜 남긴 백업인지 (없으면 하루 자동 백업) */
  reason?: string
}

/** 최신 자동 백업부터 */
export function listBackups(): Backup[] {
  try {
    const list = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? '[]') as Backup[]
    return Array.isArray(list) ? list.filter((b) => b && typeof b.data === 'string').sort((a, b) => b.at.localeCompare(a.at)) : []
  } catch {
    return []
  }
}

const dayOf = (iso: string) => iso.slice(0, 10)

/** 하루에 한 번 그날의 첫 상태를 백업 — 그날 실수로 지워도 아침 상태로 되돌릴 수 있게. 빈 데이터는 남기지 않음. */
function autoBackup(state: AppState) {
  if (!state.profile && !state.holdings.length) return
  const now = new Date().toISOString()
  if (listBackups().some((b) => !b.reason && dayOf(b.at) === dayOf(now))) return
  writeBackup({ at: now, data: JSON.stringify(state) })
}

/** 지금 데이터를 바로 백업 (불러오기·복원·초기화 직전) */
export function backupNow(state: AppState, reason: string) {
  if (!state.profile && !state.holdings.length) return
  writeBackup({ at: new Date().toISOString(), data: JSON.stringify(state), reason })
}

function writeBackup(entry: Backup) {
  const list = [entry, ...listBackups()]
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(list.slice(0, MAX_BACKUPS)))
  } catch {
    // 저장 공간이 부족하면 가장 오래된 것부터 버리고 다시 시도
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(list.slice(0, 2)))
    } catch {
      // noop
    }
  }
}

/** 백업 파일 내용 — 앱 이름·버전을 함께 적어 둠 */
export function exportState(state: AppState) {
  return JSON.stringify({ app: 'etf-design', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2)
}

/** 백업 파일 내용을 앱 데이터로 (내보낸 파일과, 데이터만 있는 예전 형식 모두) */
export function importState(text: string): AppState {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('백업 파일을 읽지 못했어요')
  }
  const wrapped = json as { app?: string; data?: unknown }
  return parseState(wrapped && wrapped.app === 'etf-design' ? wrapped.data : json)
}

/** 브라우저가 저장 공간을 정리할 때 이 앱 데이터는 지우지 않도록 요청 */
export function requestPersistentStorage() {
  try {
    void navigator.storage?.persist?.()
  } catch {
    // 지원하지 않는 브라우저
  }
}
