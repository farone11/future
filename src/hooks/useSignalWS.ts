import { useEffect, useRef, useState, useCallback } from 'react'

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
  
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<NodeJS.Timeout>()
  const heartbeatTimer = useRef<NodeJS.Timeout>()
  const retryCount = useRef(0)
  const isMounted = useRef(true)

  const connectWS = useCallback(() => {
    if (!isMounted.current) return
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
    if (ws.current?.readyState === WebSocket.OPEN) return

    const BASE_WS = import.meta.env.VITE_WS_URL || 'wss://api.faronecapital.online'
    const WS_ENDPOINT = `${BASE_WS}/ws/signals`

    console.log('[WS] Connecting to:', WS_ENDPOINT)
    ws.current = new WebSocket(WS_ENDPOINT)
    
    ws.current.onopen = () => {
      if (!isMounted.current) return
      console.log('[WS] Connected to signals')
      setConnected(true)
      retryCount.current = 0
      
      heartbeatTimer.current = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send('ping')
        }
      }, 25000)
    }
    
    ws.current.onmessage = (event) => {
      if (!isMounted.current) return
      try {
        const msg = JSON.parse(event.data)
        
        if (msg.type === 'init') {
          setSignals(msg.signals || [])
          setLastUpdate(new Date().toLocaleTimeString())
        }
        if (msg.type === 'signal_update') {
          setSignals(prev => {
            const exists = prev.find(s => s.id === msg.data.id)
            if (exists) {
              return prev.map(s => s.id === msg.data.id ? msg.data : s)
            }
            return [msg.data, ...prev]
          })
          setLastUpdate(new Date().toLocaleTimeString())
        }
        if (msg.type === 'heartbeat' || msg.type === 'pong') {
          setLastUpdate(new Date().toLocaleTimeString())
        }
        if (Array.isArray(msg)) {
          setSignals(msg)
          setLastUpdate(new Date().toLocaleTimeString())
        }
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }
    
    ws.current.onerror = (e) => {
      console.error('[WS] Error:', e)
      setConnected(false)
    }
    
    ws.current.onclose = (e) => {
      if (!isMounted.current) return
      console.log(`[WS] Closed. Code: ${e.code}. Retry in ${Math.min(1000 * Math.pow(2, retryCount.current), 10000)/1000}s`)
      setConnected(false)
      
      retryCount.current++
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 10000)
      reconnectTimer.current = setTimeout(connectWS, delay)
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    connectWS()
    
    return () => {
      isMounted.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
    }
  }, [connectWS])

  return { signals, connected, lastUpdate }
}
