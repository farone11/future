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
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryCount = useRef(0)
  const isMounted = useRef(true)

  const connectWS = useCallback(() => {
    if (!isMounted.current) return

    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }

    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current)
      heartbeatTimer.current = null
    }

    if (
      ws.current &&
      (
        ws.current.readyState === WebSocket.OPEN ||
        ws.current.readyState === WebSocket.CONNECTING
      )
    ) {
      return
    }

    const LIVE_WS = import.meta.env.VITE_WS_URL
    const SIGNAL_WS =
      import.meta.env.VITE_WS_SIGNALS_URL ||
      LIVE_WS?.replace('/ws/live', '/ws/signals') ||
      'wss://api.faronecapital.online/ws/signals'

    console.log('[SignalWS] Connecting:', SIGNAL_WS)

    try {
      ws.current = new WebSocket(SIGNAL_WS)

      ws.current.onopen = () => {
        if (!isMounted.current) return

        console.log('[SignalWS] Connected')

        setConnected(true)
        retryCount.current = 0
        setLastUpdate(new Date().toLocaleTimeString())

        heartbeatTimer.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(
              JSON.stringify({
                type: 'ping'
              })
            )
          }
        }, 25000)
      }

      ws.current.onmessage = (event) => {
        if (!isMounted.current) return

        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'init') {
            setSignals(msg.signals || [])
          }
          else if (msg.type === 'signal_update') {
            setSignals(prev => {
              const index = prev.findIndex(s => s.id === msg.data.id)

              if (index >= 0) {
                const updated = [...prev]
                updated[index] = {
                  ...updated[index],
                  ...msg.data
                }
                return updated
              }

              return [msg.data, ...prev]
            })
          }
          else if (
            msg.type === 'heartbeat' ||
            msg.type === 'pong'
          ) {
            // ignore
          }
          else if (Array.isArray(msg)) {
            setSignals(msg)
          }

          setLastUpdate(new Date().toLocaleTimeString())

        } catch (err) {
          console.error('[SignalWS] Parse Error:', err)
        }
      }

      ws.current.onerror = (err) => {
        console.error('[SignalWS] Error:', err)
        setConnected(false)
      }

      ws.current.onclose = (event) => {
        if (!isMounted.current) return

        console.log(
          `[SignalWS] Closed ${event.code}`
        )

        setConnected(false)

        retryCount.current += 1

        const delay = Math.min(
          1000 * Math.pow(2, retryCount.current),
          10000
        )

        reconnectTimer.current = setTimeout(() => {
          connectWS()
        }, delay)
      }

    } catch (err) {
      console.error('[SignalWS] Create WS failed:', err)
    }

  }, [])

  useEffect(() => {
    isMounted.current = true

    connectWS()

    return () => {
      isMounted.current = false

      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
      }

      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current)
      }

      if (ws.current) {
        ws.current.onopen = null
        ws.current.onmessage = null
        ws.current.onerror = null
        ws.current.onclose = null

        ws.current.close()
        ws.current = null
      }
    }

  }, [connectWS])

  return {
    signals,
    connected,
    lastUpdate
  }
}
