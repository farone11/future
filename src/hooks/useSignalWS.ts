import { useEffect, useRef, useState } from 'react'

export interface Signal {
  id: number
  type: 'BUY' | 'SELL'
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

export const useSignalWS = () => {
  const [signals, setSignals] = useState<Signal[]>([])
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('-')
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    const fetchSignals = async () => {
      try {
        const res = await fetch('/api/live')
        
        if (!res.ok) throw new Error('Failed to fetch')
        
        const data = await res.json()
        
        if (!isMounted.current) return

        // Kalo backend lu return {status: 'offline'}
        if (data.status === 'offline') {
          setConnected(false)
          return
        }

        // Mapping dari data KV ke format Signal
        const signalData: Signal = {
          id: data.timestamp || Date.now(),
          type: data.bias || 'BUY', // ganti sesuai field lu
          entry: data.price || data.goldPrice,
          sl: data.sl,
          tp: data.tp || data.tp1,
          tp1: data.tp1,
          tp2: data.tp2,
          status: data.status || 'LIVE',
          time: new Date().toLocaleTimeString(),
          source: data.symbol || 'XAUUSD',
          confidence: data.confidence || 0,
          pnl: data.profit || 0
        }

        // Kalo mau array, push ke signals
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
    connected,
    lastUpdate
  }
}
