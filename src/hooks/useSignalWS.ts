import { useEffect, useRef, useState } from 'react'

// Tidak hardcode, tidak pakai import.meta.env.
// - Dev (localhost): pakai proxy Vite → '/api' → https://api.faronecapital.online
// - Production (pages.dev / domain lain): langsung ke https://api.faronecapital.online
function getApiBase(): string {
  if (typeof window === 'undefined') return ''
  const { hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '' // Vite proxy handles /api
  return 'https://api.faronecapital.online'
}

export interface Signal {
  id: number | string
  type: 'BUY' | 'SELL' | 'NONE'
  entry?: number
  sl?: number
  tp?: number
  tp1?: number
  tp2?: number
  rr?: number
  status: string
  time?: string
  source?: string
  confidence?: number
  pnl?: number
}

export interface ActiveSignal {
  id?: number | string
  type?: 'BUY' | 'SELL' | 'NONE'  // backend kirim 'type', bukan 'status'
  status?: string                   // WAITING / ACTIVE / TRIGGERED
  entry?: number
  sl?: number
  tp?: number
  tp1?: number
  tp2?: number
  rr?: number
  confidence?: number
  source?: string
  time?: string
}

export interface RiskEngine {
  lot_size?: number
  drawdown?: number
  max_daily_dd?: number
  status?: string
  balance?: number
  equity?: number
  margin?: number
  free_margin?: number
  kill_switch?: boolean
}

export interface LiveData {
  ai_status: string
  gold_price: number
  ask_price: number
  spread: number
  symbol: string
  balance?: number   // di-inject dari risk_engine setelah fetch
  equity?: number    // di-inject dari risk_engine setelah fetch
  risk_engine?: RiskEngine
  updated_at: string
  updated_date: string
  active_signal: ActiveSignal | null
  win_rate: number
  total_trades: number
  open_positions: number
  data_source: string
}

export const useSignalWS = () => {
  const [signals, setSignals]       = useState<Signal[]>([])
  const [liveData, setLiveData]     = useState<LiveData | null>(null)
  const [connected, setConnected]   = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('-')
  const failCount  = useRef(0)
  const isMounted  = useRef(true)

  useEffect(() => {
    isMounted.current = true
    const controller  = new AbortController()
    const BASE        = getApiBase()

    const run = async () => {
      try {
        const [dashRes, sigRes] = await Promise.all([
          fetch(`${BASE}/api/dashboard`, { cache: 'no-store', signal: controller.signal }),
          fetch(`${BASE}/api/signals`,   { cache: 'no-store', signal: controller.signal }),
        ])

        if (!dashRes.ok) throw new Error(`Dashboard HTTP ${dashRes.status}`)
        const data: LiveData = await dashRes.json()
        if (!isMounted.current) return

        if (data.gold_price === undefined || data.gold_price === null) {
          failCount.current += 1
          if (failCount.current >= 3) setConnected(false)
          return
        }

        failCount.current = 0

        // balance & equity ada di risk_engine, inject ke top-level
        if (data.risk_engine) {
          data.balance = data.risk_engine.balance ?? 0
          data.equity  = data.risk_engine.equity  ?? 0
        }

        setLiveData(data)
        setConnected(true)
        setLastUpdate(new Date().toLocaleTimeString('id-ID'))

        // Ambil semua signals dari /api/signals (list lengkap)
        if (sigRes.ok) {
          const sigData = await sigRes.json()
          const allSignals: Signal[] = (sigData.signals ?? []).map((s: any): Signal => ({
            id:         s.id,
            type:       s.type        ?? 'NONE',
            entry:      s.entry       ?? 0,
            sl:         s.sl          ?? 0,
            tp:         s.tp1         ?? s.tp ?? 0,
            tp1:        s.tp1         ?? 0,
            tp2:        s.tp2         ?? 0,
            rr:         s.rr          ?? 0,
            status:     s.status      ?? 'WAITING',
            time:       s.time        ?? '-',
            source:     s.source      ?? 'XAUUSD',
            confidence: s.confidence  ?? 0,
            pnl:        s.pnl         ?? null,
          }))
          setSignals(prev => {
            if (
              prev.length      === allSignals.length &&
              prev[0]?.id      === allSignals[0]?.id &&
              prev[0]?.status  === allSignals[0]?.status
            ) return prev
            return allSignals
          })
        } else {
          // Fallback: pakai active_signal dari dashboard
          const active = data.active_signal
          if (!active || active.type === 'NONE' || !active.entry || active.entry === 0) {
            setSignals([])
            return
          }
          const fallback: Signal = {
            id:         active.id          ?? Date.now(),
            type:       active.type        ?? 'NONE',
            entry:      active.entry       ?? 0,
            sl:         active.sl          ?? 0,
            tp:         active.tp1         ?? active.tp ?? 0,
            tp1:        active.tp1         ?? 0,
            tp2:        active.tp2         ?? 0,
            rr:         active.rr          ?? 0,
            status:     active.status      ?? data.ai_status ?? 'STANDBY',
            time:       active.time        ?? data.updated_at ?? new Date().toLocaleTimeString('id-ID'),
            source:     active.source      ?? 'XAUUSD',
            confidence: active.confidence  ?? 0,
            pnl:        (data.equity ?? 0) - (data.balance ?? 0),
          }
          setSignals(prev => {
            const p = prev[0]
            const same = p?.id === fallback.id && p?.entry === fallback.entry &&
                         p?.sl === fallback.sl  && p?.tp1   === fallback.tp1
            return same ? prev : [fallback]
          })
        }

      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('[LiveData] Fetch error:', err)
        failCount.current += 1
        if (isMounted.current && failCount.current >= 3) setConnected(false)
      }
    }

    run()
    const interval = setInterval(run, 2000)

    return () => {
      isMounted.current = false
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  return { signals, liveData, connected, lastUpdate }
}
