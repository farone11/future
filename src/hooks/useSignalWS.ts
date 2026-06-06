import { useEffect, useRef, useState } from 'react'

// Base URL API lu yang bener
const API_URL = 'https://api.faronecapital.online'

export interface Signal {
  id: number
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
  active_signal: any
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
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    const fetchSignals = async () => {
      try {
        // Pake domain API yang bener
        const res = await fetch(`${API_URL}/api/dashboard`, {
          cache: 'no-store' // biar gak ke-cache browser
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data: LiveData = await res.json()

        if (!isMounted.current) return

        // Cek data valid
        if (!data.gold_price) {
          setConnected(false)
          return
        }

        setLiveData(data)

        // Mapping ke format Signal buat sidebar kiri
        const signalData: Signal = {
          id: Date.now(),
          type: data.active_signal?.status === 'BUY'? 'BUY' :
                data.active_signal?.status === 'SELL'? 'SELL' : 'NONE',
          entry: data.gold_price, // pake gold_price dari API
          sl: data.active_signal?.sl || 0,
          tp: data.active_signal?.tp1 || 0,
          tp1: data.active_signal?.tp1 || 0,
          tp2: data.active_signal?.tp2 || 0,
          status: data.ai_status || 'STANDBY',
          time: data.updated_at || new Date().toLocaleTimeString(),
          source: 'XAUUSD', // force XAUUSD biar gak XAUUSDc
          confidence: data.active_signal?.confidence || 0,
          pnl: data.equity - data.balance || 0
        }

        setSignals([signalData])
        setConnected(true)
        setLastUpdate(new Date().toLocaleTimeString())

      } catch (err) {
        console.error('[LiveData] Fetch Error:', err)
        if (isMounted.current) setConnected(false)
      }
    }

    fetchSignals() // load pertama
    const interval = setInterval(fetchSignals, 2000) // update tiap 2 detik

    return () => {
      isMounted.current = false
      clearInterval(interval)
    }
  }, [])

  return {
    signals,
    liveData, // ini buat nampilin gold_price, spread, dll di dashboard
    connected,
    lastUpdate
  }
}
