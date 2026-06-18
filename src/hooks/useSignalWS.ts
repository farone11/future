import { useEffect, useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL
const WS_URL = import.meta.env.VITE_WS_URL

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
  type?: 'BUY' | 'SELL' | 'NONE'   // FIX 1: backend kirim 'type', bukan 'status'
  status?: string                   // FIX 1: status = WAITING/ACTIVE/TRIGGERED
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
  // FIX 2: balance & equity TIDAK ada di top-level dashboard response.
  // Keduanya ada di dalam risk_engine. Optional di sini supaya tidak error.
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

    if (data.gold_price === undefined || data.gold_price === null) {
      failCount.current += 1
      if (failCount.current >= 3) setConnected(false)
      return
    }

    if (data.type === 'ping') return

    failCount.current = 0

    // FIX 2: Inject balance & equity dari risk_engine ke top-level
    // supaya Sidebar dan komponen lain bisa baca data.balance / data.equity
    if (data.risk_engine) {
      data.balance = data.risk_engine.balance ?? 0
      data.equity  = data.risk_engine.equity  ?? 0
    }

    setLiveData(data)
    setConnected(true)
    setLastUpdate(new Date().toLocaleTimeString('id-ID'))

    const active = data.active_signal

    // FIX 1: Cek active.type (BUY/SELL), bukan active.status
    if (!active || active.type === 'NONE' || !active.entry || active.entry === 0) {
      setSignals([])
      return
    }

    const newSignal: Signal = {
      id:         active.id          ?? Date.now(),
      type:       active.type        ?? 'NONE',   // FIX 1: gunakan 'type'
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
      // FIX 2: pnl pakai data dari risk_engine yang sudah di-inject
      pnl: (data.equity ?? 0) - (data.balance ?? 0)
    }

    setSignals(prev => {
      const prev0 = prev[0]
      const isSame =
        prev0?.id    === newSignal.id    &&
        prev0?.entry === newSignal.entry &&
        prev0?.sl    === newSignal.sl    &&
        prev0?.tp1   === newSignal.tp1
      return isSame ? prev : [newSignal]
    })
  }

  // FIX 3: Fetch /api/signals secara paralel dengan dashboard
  // supaya semua signal (WAITING/ACTIVE/TRIGGERED/CLOSED) ikut tampil,
  // bukan hanya satu active_signal dari dashboard.
  const fetchAllSignals = async (signal?: AbortSignal) => {
    const [dashRes, sigRes] = await Promise.all([
      fetch(`${API_URL}/api/dashboard`, { cache: 'no-store', signal }),
      fetch(`${API_URL}/api/signals`,   { cache: 'no-store', signal })
    ])

    if (!dashRes.ok) throw new Error(`Dashboard HTTP ${dashRes.status}`)
    const data: LiveData = await dashRes.json()
    processData(data)

    // Timpa signals dengan list lengkap kalau /api/signals berhasil
    if (sigRes.ok) {
      const sigData = await sigRes.json()
      const allSignals: Signal[] = (sigData.signals ?? []).map((s: any) => ({
        id:         s.id,
        type:       s.type        ?? 'NONE',  // FIX 1: 'type' bukan 'status'
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
          prev.length === allSignals.length &&
          prev[0]?.id     === allSignals[0]?.id &&
          prev[0]?.status === allSignals[0]?.status
        ) return prev
        return allSignals
      })
    }
  }

  const connectPolling = () => {
    const controller = new AbortController()

    const run = async () => {
      try {
        await fetchAllSignals(controller.signal)
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('[Polling] Fetch Error:', err)
        failCount.current += 1
        if (isMounted.current && failCount.current >= 3) setConnected(false)
      }
    }

    run()
    const interval = setInterval(run, 2000)
    return () => { controller.abort(); clearInterval(interval) }
  }

  const connectWebSocket = () => {
    if (!WS_URL) {
      console.warn('VITE_WS_URL not set. Falling back to polling.')
      pollingCleanupRef.current = connectPolling()
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) return

    wsRef.current = new WebSocket(WS_URL)

    wsRef.current.onopen = () => {
      console.log('[WS] Connected')
      setConnected(true)
      failCount.current = 0
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current()
        pollingCleanupRef.current = undefined
      }
    }

    wsRef.current.onmessage = (event) => {
      try {
        const data: LiveData = JSON.parse(event.data)
        processData(data)
        // FIX 3: WS hanya kirim active_signal. Tetap polling /api/signals
        // di background supaya list signal lengkap selalu ter-update.
        if (!pollingCleanupRef.current) {
          pollingCleanupRef.current = connectPolling()
        }
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }

    wsRef.current.onerror = (err) => {
      console.error('[WS] Error:', err)
      failCount.current += 1
      setConnected(false)
    }

    wsRef.current.onclose = () => {
      console.log('[WS] Disconnected')
      setConnected(false)
      if (isMounted.current) {
        if (!pollingCleanupRef.current) {
          pollingCleanupRef.current = connectPolling()
        }
        // FIX 4: Hanya reconnect WS kalau VITE_WS_URL tersedia
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000)
      }
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
