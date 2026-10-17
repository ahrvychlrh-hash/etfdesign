import { ACCOUNT_KINDS, type Account, type AppState, type CryptoAsset, type EtfStats, type Holding, type Profile } from './types'
import { isCrypto } from './presets'

const KEY = 'etf-planner/v1'

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

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<AppState>
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
  } catch {
    return empty
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 저장 공간을 쓸 수 없는 환경(시크릿 모드 등)에서는 메모리에만 유지
  }
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
