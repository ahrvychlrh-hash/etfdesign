import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account, AppState, Holding, Profile } from './lib/types'
import { backupNow, clearState, emptyState, loadState, requestPersistentStorage, saveState } from './lib/storage'
import { fetchMonthEnd, fetchQuote, loadBenchmarks } from './lib/api'
import { setBenchmarks } from './lib/expected'
import { computePlan, cryptoTotal, DEFAULT_RATE, splitReserve } from './lib/plan'
import { holdingValue } from './lib/finance'
import { monthKey, prevMonth, realPrincipal } from './lib/history'
import { Onboarding } from './components/Onboarding'
import { Home } from './components/Home'
import { Holdings } from './components/Holdings'
import { Goal } from './components/Goal'
import { Rebalance } from './components/Rebalance'
import { History } from './components/History'
import { HoldingSheet } from './components/HoldingSheet'
import { AccountSheet } from './components/AccountSheet'
import { TabBar, type Tab } from './components/ui'

const STALE_MS = 10 * 60_000

type SheetState = { holding: Holding } | { newIn?: string } | null

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [editingProfile, setEditingProfile] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const holdingsRef = useRef(state.holdings)
  holdingsRef.current = state.holdings
  const cryptosRef = useRef(state.cryptos)
  cryptosRef.current = state.cryptos

  useEffect(() => saveState(state), [state])
  // 브라우저가 저장 공간을 정리할 때 이 앱 데이터는 지우지 않도록 요청
  useEffect(() => requestPersistentStorage(), [])

  // 이번 달 자산을 기록 — 그 달에 마지막으로 기록된 값이 월말 자산이 됨
  useEffect(() => {
    if (!state.profile) return
    // 비상금 계좌는 수익률 기록에서 뺌
    const { investHoldings } = splitReserve(state.holdings, state.accounts)
    const value = investHoldings.reduce((s, h) => s + holdingValue(h), 0)
    if (value <= 0) return
    const principal = realPrincipal(investHoldings, state.reinvests)
    const key = monthKey()
    const prev = state.snapshots[key]
    if (prev?.manual) return
    if (prev && Math.round(prev.value) === Math.round(value) && Math.round(prev.principal) === Math.round(principal)) return
    setState((s) => ({
      ...s,
      snapshots: { ...s.snapshots, [key]: { value, principal, at: new Date().toISOString() } },
    }))
  }, [state.profile, state.holdings, state.accounts, state.reinvests, state.snapshots])

  // 지난달 기록이 월말 전에 저장된 것이면, 앱을 처음 열 때 지난달 마지막 거래일 종가로 다시 계산
  // (그 사이 매수·매도로 원금이 바뀌었으면 수량을 알 수 없어서 그대로 둠)
  const monthEndChecked = useRef(false)
  useEffect(() => {
    if (!state.profile || monthEndChecked.current) return
    monthEndChecked.current = true
    const month = prevMonth(monthKey())
    const snap = state.snapshots[month]
    if (!snap || snap.manual || snap.closed) return
    const close = (patch: Partial<typeof snap>) =>
      setState((s) => ({ ...s, snapshots: { ...s.snapshots, [month]: { ...s.snapshots[month], ...patch, closed: true } } }))
    const { investHoldings } = splitReserve(state.holdings, state.accounts)
    if (Math.round(realPrincipal(investHoldings, state.reinvests)) !== Math.round(snap.principal)) return close({})
    const auto = investHoldings.filter((h) => h.priceMode === 'auto')
    fetchMonthEnd(month, auto.map((h) => h.symbol))
      .then((prices) => {
        // 한 종목이라도 종가를 못 구하면 보정하지 않음
        if (auto.some((h) => !prices[h.symbol.toUpperCase()])) return close({})
        const value = investHoldings.reduce(
          (sum, h) => sum + h.quantity * (h.priceMode === 'auto' ? (prices[h.symbol.toUpperCase()] as number) : h.currentPrice),
          0,
        )
        close({ value })
      })
      .catch(() => {
        // 네트워크 오류면 다음에 다시 시도
        monthEndChecked.current = false
      })
  }, [state.profile, state.snapshots, state.holdings, state.accounts, state.reinvests])

  /** 현재가·과거 성과·배당을 다시 불러옵니다. (코인 현물 시세 포함) */
  const refresh = useCallback(async (force: boolean) => {
    const stale = (at?: string) => force || !at || Date.now() - new Date(at).getTime() > STALE_MS
    const symbols = [
      ...new Set([
        ...holdingsRef.current.filter((h) => stale(h.stats?.updatedAt)).map((h) => h.symbol),
        ...cryptosRef.current.filter((c) => stale(c.updatedAt)).map((c) => c.symbol),
      ]),
    ]
    if (!symbols.length) return
    setRefreshing(true)
    const results = await Promise.allSettled(symbols.map((s) => fetchQuote(s)))
    const bySymbol = new Map<string, Awaited<ReturnType<typeof fetchQuote>>>()
    results.forEach((r) => r.status === 'fulfilled' && bySymbol.set(r.value.symbol, r.value))
    setState((s) => ({
      ...s,
      holdings: s.holdings.map((h) => {
        const q = bySymbol.get(h.symbol.toUpperCase())
        if (!q) return h
        return { ...h, stats: q.stats, currentPrice: h.priceMode === 'auto' ? q.price : h.currentPrice }
      }),
      cryptos: s.cryptos.map((c) => {
        const q = bySymbol.get(c.symbol.toUpperCase())
        return q ? { ...c, price: q.price, updatedAt: q.stats.updatedAt } : c
      }),
    }))
    setRefreshing(false)
  }, [])

  // 기초지수 장기 평균을 받아오면 기대 수익률을 다시 계산
  const [, setBenchVersion] = useState(0)
  useEffect(() => {
    loadBenchmarks()
      .then((b) => {
        setBenchmarks(b)
        setBenchVersion((v) => v + 1)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refresh(false)
  }, [refresh])

  const updateProfile = (patch: Partial<Profile>) =>
    setState((s) => ({ ...s, profile: s.profile && { ...s.profile, ...patch } }))

  if (!state.profile || editingProfile) {
    const ps = splitReserve(state.holdings, state.accounts)
    const preview = state.profile ? computePlan(state.profile, ps.investHoldings, state.realEstates, ps.reserveTotal, cryptoTotal(state.cryptos)) : null
    return (
      <Onboarding
        initial={state.profile}
        currentTotal={preview?.etf.value ?? 0}
        fixedAssets={preview?.fixed ?? 0}
        rate={preview?.rate ?? DEFAULT_RATE}
        rateFromEtf={preview?.etfRate != null}
        onCancel={state.profile ? () => setEditingProfile(false) : undefined}
        onDone={(profile) => {
          setState((s) => ({ ...s, profile }))
          setEditingProfile(false)
        }}
      />
    )
  }

  const { profile, holdings, accounts } = state
  // 비상금 계좌(ETF·현금)는 총자산에만 넣고 투자 계산에서는 뺌
  const split = splitReserve(holdings, accounts)
  const investHoldings = split.investHoldings
  const plan = computePlan(profile, investHoldings, state.realEstates, split.reserveTotal, cryptoTotal(state.cryptos))
  const reinvest = (v: boolean) => updateProfile({ reinvest: v })
  const counts = new Map<string, number>()
  holdings.forEach((h) => counts.set(h.accountId, (counts.get(h.accountId) ?? 0) + 1))
  const editing = sheet && 'holding' in sheet ? sheet.holding : undefined

  const deleteAccount = (id: string) =>
    setState((s) => {
      const rest = s.accounts.filter((a) => a.id !== id)
      if (!rest.length) return s
      return {
        ...s,
        accounts: rest,
        holdings: s.holdings.map((h) => (h.accountId === id ? { ...h, accountId: rest[0].id } : h)),
      }
    })

  return (
    <div className="shell">
      <div className="app">
        <main className="app__scroll">
          {tab === 'home' && (
            <Home
              profile={profile}
              holdings={investHoldings}
              plan={plan}
              onTab={setTab}
              onAdd={() => setSheet({})}
              onReinvest={reinvest}
            />
          )}
          {tab === 'holdings' && (
            <Holdings
              profile={profile}
              accounts={accounts}
              holdings={holdings}
              plan={plan}
              refreshing={refreshing}
              onAdd={(accountId) => setSheet({ newIn: accountId })}
              onEdit={(holding) => setSheet({ holding })}
              onRefresh={() => refresh(true)}
              onReinvest={reinvest}
              onManageAccounts={() => setAccountsOpen(true)}
              reinvests={state.reinvests}
              investHoldings={investHoldings}
              realEstates={state.realEstates}
              onSaveRealEstate={(r) =>
                setState((s) => ({
                  ...s,
                  realEstates: s.realEstates.some((x) => x.id === r.id)
                    ? s.realEstates.map((x) => (x.id === r.id ? r : x))
                    : [...s.realEstates, r],
                }))
              }
              onDeleteRealEstate={(id) => setState((s) => ({ ...s, realEstates: s.realEstates.filter((x) => x.id !== id) }))}
              cryptos={state.cryptos}
              onSaveCrypto={(c) =>
                setState((s) => ({
                  ...s,
                  cryptos: s.cryptos.some((x) => x.id === c.id) ? s.cryptos.map((x) => (x.id === c.id ? c : x)) : [...s.cryptos, c],
                }))
              }
              onDeleteCrypto={(id) => setState((s) => ({ ...s, cryptos: s.cryptos.filter((x) => x.id !== id) }))}
            />
          )}
          {tab === 'history' && (
            <History
              holdings={investHoldings}
              snapshots={state.snapshots}
              reinvests={state.reinvests}
              onSnapshot={(month, snap) =>
                setState((s) => {
                  const next = { ...s.snapshots }
                  if (snap) next[month] = snap
                  else delete next[month]
                  return { ...s, snapshots: next }
                })
              }
              onAddReinvest={(r) => setState((s) => ({ ...s, reinvests: [...s.reinvests, r] }))}
              onUpdateReinvest={(r) => setState((s) => ({ ...s, reinvests: s.reinvests.map((x) => (x.id === r.id ? r : x)) }))}
              onDeleteReinvest={(id) => setState((s) => ({ ...s, reinvests: s.reinvests.filter((r) => r.id !== id) }))}
            />
          )}
          {tab === 'rebalance' && (
            <Rebalance
              holdings={investHoldings}
              targets={state.targets}
              onTargets={(targets) => setState((s) => ({ ...s, targets }))}
            />
          )}
          {tab === 'goal' && (
            <Goal
              profile={profile}
              plan={plan}
              onEdit={() => setEditingProfile(true)}
              state={state}
              onImport={(next) => setState(next)}
              onReset={() => {
                backupNow(state, '초기화 전')
                clearState()
                setState(emptyState())
                setTab('home')
              }}
            />
          )}
        </main>
        <TabBar tab={tab} onChange={setTab} />
      </div>

      {sheet && (
        <HoldingSheet
          initial={editing}
          accounts={accounts}
          defaultAccountId={('newIn' in sheet && sheet.newIn) || accounts[0].id}
          reinvest={profile.reinvest}
          onClose={() => setSheet(null)}
          onManageAccounts={() => setAccountsOpen(true)}
          onSave={(h) => {
            setState((s) => {
              const exists = s.holdings.some((x) => x.id === h.id)
              return {
                ...s,
                holdings: exists ? s.holdings.map((x) => (x.id === h.id ? h : x)) : [...s.holdings, h],
              }
            })
            setSheet(null)
          }}
          onDelete={
            editing
              ? () => {
                  setState((s) => ({ ...s, holdings: s.holdings.filter((x) => x.id !== editing.id) }))
                  setSheet(null)
                }
              : undefined
          }
        />
      )}

      {accountsOpen && (
        <AccountSheet
          accounts={accounts}
          counts={counts}
          onChange={(next: Account[]) => setState((s) => ({ ...s, accounts: next }))}
          onDelete={deleteAccount}
          onClose={() => {
            // 이름을 비워둔 계좌는 기본 이름으로
            setState((s) => ({ ...s, accounts: s.accounts.map((a) => (a.name.trim() ? a : { ...a, name: '이름 없는 계좌' })) }))
            setAccountsOpen(false)
          }}
        />
      )}
    </div>
  )
}
