import { useEffect, useRef, useState } from 'react'

function getApiBase(): string {
  if (typeof window === 'undefined') return ''
  // Pake env var, fallback ke window.location
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  const { hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') return ''
  return 'https://api.faronecapital.online'
}

export interface SessionData {
  high: number
  low: number
  mid: number
  range: number
  high_time: number
  low_time: number
}

export interface LiquidityZone {
  type: 'BSL' | 'SSL'
  price: number
  status: 'ACTIVE' | 'SWEPT'
  age: string
  timestamp?: number
  ob: boolean
  session?: string
}

export interface LiquidityData {
  sessions: {
    asia: SessionData
    london: SessionData
    newyork: SessionData
  }
  liquidity_zones: LiquidityZone[]
}

export const useLiquidityWS = () => {
  const [data, setData] = useState<LiquidityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const failCount = useRef(0)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    const controller = new AbortController()
    const BASE = getApiBase()

    const run = async () => {
      try {
        const res = await fetch(`${BASE}/api/mt5-sessions`, {
          cache: 'no-store',
          signal: controller.signal
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: LiquidityData = await res.json()
        if (!isMounted.current) return

        setData(json)
        setConnected(true)
        setError(null)
        failCount.current = 0
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('[LiquidityWS] Fetch error:', err)
        failCount.current += 1
        if (isMounted.current && failCount.current >= 3) {
          setConnected(false)
          setError('Failed to connect to liquidity API')
        }
      } finally {
        setLoading(false)
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

  return { data, loading, error, connected }
}