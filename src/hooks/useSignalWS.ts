import { useEffect, useRef, useState } from 'react'

const API_URL = 'https://api.faronecapital.online'

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
  status?: 'BUY' | 'SELL' | 'NONE'
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

export interface LiveData {
  ai_status: string
  gold_price: number
  ask_price: number
  spread: number
  symbol: string
  balance: number
  equity: number
  updated_at: string
  updated_date: string
  active_signal: ActiveSignal | null
  win_rate: number
  total_trades: number
  open_positions: number
  data_source: string
  risk_engine?: any
}

export const useSignalWS = () => {
  const [signals, setSignals] = useState<Signal[]>([])
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('-')
  const failCount = useRef(0)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    const controller = new AbortController()

    const fetchSignals = async () => {
      try {
        const res = await fetch(`${API_URL}/api/dashboard`, {
          cache: 'no-store',
          signal: controller.signal
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data: LiveData = await res.json()
        if (!isMounted.current) return

        if (!data.gold_price) {
          failCount.current += 1
          if (failCount.current >= 3) setConnected(false)
          return
        }

        failCount.current = 0
        setLiveData(data)
        setConnected(true)
        setLastUpdate(new Date().toLocaleTimeString('id-ID'))

        const active = data.active_signal

        // Kalau ga ada signal valid, kosongin array biar UI ga nampilin dummy
        if (!active || active.status === 'NONE' ||!active.entry || active.entry === 0) {
          setSignals([])
          return
        }

        const newSignal: Signal = {
          id: active.id?? Date.now(),
          type: active.status?? 'NONE',
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
          pnl: (data.equity?? 0) - (data.balance?? 0)
        }

        // Cuma update kalau data bener-bener berubah
        setSignals(prev => {
          const prevSignal = prev[0]
          const isSame = 
            prevSignal?.id === newSignal.id &&
            prevSignal?.entry === newSignal.entry &&
            prevSignal?.sl === newSignal.sl &&
            prevSignal?.tp1 === newSignal.tp1
          return isSame? prev : [newSignal]
        })

      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('[LiveData] Fetch Error:', err)
        failCount.current += 1
        if (isMounted.current && failCount.current >= 3) {
          setConnected(false)
        }
      }
    }

    fetchSignals()
    const interval = setInterval(fetchSignals, 2000)

    return () => {
      isMounted.current = false
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  return {
    signals,
    liveData,
    connected,
    lastUpdate
  }
}
