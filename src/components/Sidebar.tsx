import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Signal,
  History,
  Settings,
  ChevronLeft,
  Menu,
  X,
  Activity
} from 'lucide-react'

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  'wss://api.faronecapital.online/ws/live'

interface DashboardData {
  ai_status: string
  gold_price: number
  daily_change: number
  win_rate: number
  total_trades: number
  active_signal: {
    status: 'BUY' | 'SELL' | 'NONE'
    entry: number
    sl: number
    tp1: number
    tp2?: number
    tp3?: number
    source?: string
    confidence?: number
  }
  risk_engine: {
    lot_size: number
    drawdown: number
    status: string
  }
}

export default function Sidebar() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const [wsStatus, setWsStatus] =
    useState<'connecting' | 'live' | 'error'>('connecting')

  const navigate = useNavigate()
  const location = useLocation()

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const resize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true)
        setIsMobileOpen(false)
      } else {
        setIsCollapsed(false)
      }
    }

    resize()

    window.addEventListener('resize', resize)

    return () =>
      window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    let mounted = true

    const connectWS = () => {
      if (!mounted) return

      wsRef.current?.close()

      setWsStatus('connecting')

      console.log('Connecting WS:', WS_URL)

      const ws = new WebSocket(WS_URL)

      wsRef.current = ws

      ws.onopen = () => {
        if (!mounted) return

        console.log('WS CONNECTED')

        setWsStatus('live')
      }

      ws.onmessage = (event) => {
        try {
          const liveData = JSON.parse(event.data)

          setData(prev => ({
            ...prev,
            ...liveData
          }))
        } catch (err) {
          console.error('WS Parse Error', err)
        }
      }

      ws.onerror = () => {
        if (!mounted) return

        console.log('WS ERROR')

        setWsStatus('error')
      }

      ws.onclose = () => {
        if (!mounted) return

        console.log('Reconnect in 3s')

        setWsStatus('error')

        reconnectRef.current =
          setTimeout(connectWS, 3000)
      }
    }

    connectWS()

    return () => {
      mounted = false

      if (reconnectRef.current)
        clearTimeout(reconnectRef.current)

      wsRef.current?.close()
    }
  }, [])

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Signal, label: 'Signals', path: '/signals' },
    { icon: History, label: 'History', path: '/history' },
    { icon: Settings, label: 'Settings', path: '/settings' }
  ]

  return (
    <>
      {/* sisanya BIARKAN SAMA */}
    </>
  )
}
