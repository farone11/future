import { useEffect, useRef, useState } from 'react'

// URL logic: dev pake proxy, prod pake.env
function getApiBase(): string {
  if (typeof window === 'undefined') return ''
  const { hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '' // Vite proxy /api
  return import.meta.env.VITE_API_URL?? 'https://api.faronecapital.online'
}

function getWsUrl(): string {
  if (typeof window === 'undefined') return ''
  const { hostname, protocol } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Dev: ws://localhost:3001/signals
    return import.meta.env.VITE_WS_URL?? 'ws://localhost:3001/signals'
  }
  // Prod: wss://api.faronecapital.online/signals
  const base = import.meta.env.VITE_API_URL?? 'https://api.faronecapital.online'
  return base.replace(/^http/, 'ws') + '/signals'
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
  type?: 'BUY' | 'SELL' | 'NONE'
  status?: string
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
  type?: 'update' | 'ping'
  ai_status: string
  gold_price: number
  ask_price: number
  spread: number
  symbol: string
  balance?: number
  equity?: number
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
  const [signals, setSignals] = useState<Signal[]>([])
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('-')
  const failCount = useRef(0)
  const isMounted = useRef(true)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const pollingCleanupRef = useRef<() => void>()

  const processData = (data: LiveData) => {
    if (!isMounted.current) return

    // FIX 1: 0 itu valid. Cuma skip kalo undefined/null
    if (data.gold_price === undefined || data.gold_price === null) {
      failCount.current += 1
      if (failCount.current >= 3) setConnected(false)
      return
    }

    // FIX 2: Ignore ping dari backend
    if (data.type === 'ping') return

    failCount.current = 0

    // Inject balance/equity dari risk_engine ke top level
    if (data.risk_engine) {
      data.balance = data.risk_engine.balance?? 0
      data.equity = data.risk_engine.equity?? 0
    }

    setLiveData(data)
    setConnected(true)
    setLastUpdate(new Date().toLocaleTimeString('id-ID'))

    const active = data.active_signal

    if (!active || active.type === 'NONE' ||!active.entry || active.entry === 0) {
      setSignals([])
      return
    }

    const newSignal: Signal = {
      id: active.id?? Date.now(),
      type: active.type?? 'NONE',
      entry: active.entry?? 0,
      sl: active.sl?? 0,
      tp: active.tp1?? active.tp?? 0,
      tp1: active.tp1?? 0,
      tp2: active.tp2?? 0,
      rr: active.rr?? 0,
      status: active.status?? data.ai_status?? 'STANDBY',
      time: active.time?? data.updated_at?? new Date().toLocaleTimeString('id-ID'),
      source: active.source?? 'XAUUSD',
      confidence: active.confidence?? 0,
      pnl: (data.equity?? 0) - (data.balance?? 0),
    }

    setSignals(prev => {
      const p = prev[0]
      const same = p?.id === newSignal.id && p?.entry === newSignal.entry &&
                   p?.sl === newSignal.sl && p?.tp1 === newSignal.tp1
      return same? prev : [newSignal]
    })
  }

  const connectWebSocket = () => {
    const WS_URL = getWsUrl()
    if (!WS_URL) {
      console.warn('WS_URL not set. Falling back to polling.')
      pollingCleanupRef.current = connectPolling()
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) return

    console.log('[WS] Connecting to', WS_URL)
    wsRef.current = new WebSocket(WS_URL)

    wsRef.current.onopen = () => {
      console.log('[WS] Connected')
      setConnected(true)
      failCount.current = 0
      // Matikan polling kalo WS nyala
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current()
        pollingCleanupRef.current = undefined
      }
    }

    wsRef.current.onmessage = (event) => {
      try {
        const data: LiveData = JSON.parse(event.data)
        processData(data)
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }

    wsRef.current.onerror = (err) => {
      console.error('[WS] Error:', err)
      setConnected(false)
    }

    wsRef.current.onclose = () => {
      console.log('[WS] Disconnected')
      setConnected(false)
      if (isMounted.current) {
        // Fallback ke polling + reconnect WS
        if (!pollingCleanupRef.current) {
          pollingCleanupRef.current = connectPolling()
        }
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000)
      }
    }
  }

  const connectPolling = () => {
    const controller = new AbortController()
    const BASE = getApiBase()

    const fetchSignals = async () => {
      try {
        const res = await fetch(`${BASE}/api/dashboard`, {
          cache: 'no-store',
          signal: controller.signal
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: LiveData = await res.json()
        processData(data)
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('[Polling] Fetch Error:', err)
        failCount.current += 1
        if (isMounted.current && failCount.current >= 3) {
          setConnected(false)
        }
      }
    }

    fetchSignals()
    const interval = setInterval(fetchSignals, 2000)

    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }

  useEffect(() => {
    isMounted.current = true
    connectWebSocket()

    return () => {
      isMounted.current = false
      wsRef.current?.close()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (pollingCleanupRef.current) pollingCleanupRef.current()
    }
  }, [])

  return { signals, liveData, connected, lastUpdate }
}