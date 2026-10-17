import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account, AppState, Holding, Profile } from './lib/types'
import { clearState, emptyState, loadState, saveState } from './lib/storage'
import { fetchQuote, loadBenchmarks } from './lib/api'
import { setBenchmarks } from './lib/expected'
import { computePlan, DEFAULT_RATE } from './lib/plan'
import { holdingValue } from './lib/finance'
import { monthKey, realPrincipal } from './lib/history'
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

  useEffect(() => saveState(state), [state])

  // 이번 달 자산을 기록 — 그 달에 마지막으로 기록된 값이 월말 자산이 됨
  useEffect(() => {
    if (!state.profile) return
    const value = state.holdings.reduce((s, h) => s + holdingValue(h), 0)
    if (value <= 0) return
    const principal = realPrincipal(state.holdings, state.reinvests)
    const key = monthKey()
    const prev = state.snapshots[key]
    if (prev?.manual) return
    if (prev && Math.round(prev.value) === Math.round(value) && Math.round(prev.principal) === Math.round(principal)) return
    setState((s) => ({
      ...s,
      snapshots: { ...s.snapshots, [key]: { value, principal, at: new Date().toISOString() } },
    }))
  }, [state.profile, state.holdings, state.reinvests, state.snapshots])

  /** 현재가·과거 성과·배당을 다시 불러옵니다. */
  const refresh = useCallback(async (force: boolean) => {
    const symbols = [
      ...new Set(
        holdingsRef.current
          .filter((h) => force || !h.stats || Date.now() - new Date(h.stats.updatedAt).getTime() > STALE_MS)
          .map((h) => h.symbol),
      ),
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
    const preview = state.profile ? computePlan(state.profile, state.holdings, state.realEstates) : null
    return (
      <Onboarding
        initial={state.profile}
        currentTotal={preview?.etf.value ?? 0}
        fixedAssets={preview?.realEstate ?? 0}
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
  const plan = computePlan(profile, holdings, state.realEstates)
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
              holdings={holdings}
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
            />
          )}
          {tab === 'history' && (
            <History
              holdings={holdings}
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
              onDeleteReinvest={(id) => setState((s) => ({ ...s, reinvests: s.reinvests.filter((r) => r.id !== id) }))}
            />
          )}
          {tab === 'rebalance' && (
            <Rebalance
              holdings={holdings}
              targets={state.targets}
              onTargets={(targets) => setState((s) => ({ ...s, targets }))}
            />
          )}
          {tab === 'goal' && (
            <Goal
              profile={profile}
              plan={plan}
              onEdit={() => setEditingProfile(true)}
              onReset={() => {
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
