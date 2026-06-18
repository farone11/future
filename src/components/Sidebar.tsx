import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Signal, History, Settings, ChevronLeft, Menu, X, Activity, Droplets, BarChart3 } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.faronecapital.online'
const DASHBOARD_URL = `${API_URL}/api/dashboard`

// Debug: log sekali pas file di-load
console.log('[Sidebar] API_URL:', API_URL)
console.log('[Sidebar] DASHBOARD_URL:', DASHBOARD_URL)

interface DashboardData {
  ai_status: string
  gold_price: number
  ask_price: number
  daily_change: number
  daily_change_pct: number
  win_rate: number
  total_trades: number
  data_source: string
  spread: number
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
    max_daily_dd: number
    status: string
    balance: number
    equity: number
    margin: number
    free_margin: number
    kill_switch: boolean
  }
}

export default function Sidebar() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const navigate = useNavigate()
  const location = useLocation()
  const intervalRef = useRef<NodeJS.Timeout>()
  const abortRef = useRef<AbortController>()

  useEffect(() => {
    const checkScreen = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true)
        setIsMobileOpen(false)
      } else {
        setIsCollapsed(false)
        setIsMobileOpen(false)
      }
    }
    checkScreen()
    window.addEventListener('resize', checkScreen)
    return () => window.removeEventListener('resize', checkScreen)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      
      try {
        console.log('[Sidebar] Fetching:', DASHBOARD_URL)
        const res = await fetch(DASHBOARD_URL, { 
          signal: abortRef.current.signal,
          cache: 'no-store',
          mode: 'cors' // explicit CORS
        })
        
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`HTTP ${res.status}: ${text}`)
        }
        
        const liveData = await res.json()
        console.log('[Sidebar] Data received:', liveData)
        setData(liveData)
        setApiStatus('live')
      } catch (e: any) {
        if (e.name === 'AbortError') return
        console.error('❌ Sidebar API Error:', e.message, e)
        setApiStatus('error')
      }
    }

    setApiStatus('connecting')
    fetchData()
    intervalRef.current = setInterval(fetchData, 2000)

    return () => {
      abortRef.current?.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Signal, label: 'Signals', path: '/signals' },
    { icon: Droplets, label: 'Liquidity Zones', path: '/liquidity-zones' },
    { icon: History, label: 'History', path: '/history' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ]

  const handleNavigate = (path: string) => {
    navigate(path)
    if (window.innerWidth < 1024) setIsMobileOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-white"
      >
        {isMobileOpen? <X size={20} /> : <Menu size={20} />}
      </button>

      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-[55]"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static top-0 left-0 h-screen bg-zinc-900 border-r border-zinc-800
        transition-all duration-300 z-[56] flex flex-col font-sans
        ${isCollapsed &&!isMobileOpen? 'w-20' : 'w-64'}
        ${isMobileOpen? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        <div className="flex items-center justify-between p-4 h-16 border-b border-zinc-800 flex-shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <img 
                src="/Logo.png" 
                alt="Futuristic Gold" 
                className="w-8 h-8 object-contain rounded" 
                onError={(e) => e.currentTarget.style.display = 'none'} 
              />
              <div>
                <div className="font-bold text-sm text-white leading-tight">FUTURISTIC</div>
                <div className="text-xs text-yellow-500">GOLD AI</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-zinc-800 rounded hidden lg:block text-gray-400"
          >
            <ChevronLeft className={`w-5 h-5 transition-transform ${isCollapsed? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="p-4 flex-shrink-0">
          {menuItems.map((item) => (
            <div
              key={item.label}
              onClick={() => handleNavigate(item.path)}
              className={`flex items-center gap-3 p-3 rounded-lg mb-2 cursor-pointer transition-colors ${
                location.pathname === item.path
             ? 'bg-yellow-500/20 text-yellow-400'
                  : 'hover:bg-zinc-800 text-gray-400'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </div>
          ))}
        </nav>

        {!isCollapsed && (
          <div className="p-4 text-xs space-y-3 border-t border-zinc-800 overflow-y-auto flex-1">
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Connection</span>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  apiStatus === 'live'? 'bg-green-500 animate-pulse' : 
                  apiStatus === 'connecting'? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className={
                  apiStatus === 'live'? 'text-green-400' : 
                  apiStatus === 'connecting'? 'text-yellow-400' : 'text-red-400'
                }>
                  {apiStatus.toUpperCase()}
                </span>
              </div>
            </div>

            <div>
              <div className="text-gray-500 flex items-center gap-1 text-xs">
                <Activity size={12} /> AI SIGNAL CENTER
              </div>
              <div className={`text-lg font-bold ${
                data?.ai_status === 'ACTIVE'? 'text-green-400' :
                data?.ai_status === 'KILL SWITCH'? 'text-red-400' : 'text-gray-400'
              }`}>
                {data?.ai_status || 'STANDBY'}
              </div>
              <div className="text-xs text-gray-500">Source: {data?.data_source || 'NONE'}</div>
            </div>

            <div>
              <div className="text-gray-500 text-xs">$ GOLD PRICE</div>
              <div className="text-2xl font-bold text-yellow-400">
                ${data?.gold_price?.toFixed(2) || '0.00'}
              </div>
              <div className={`text-xs ${data?.daily_change >= 0? 'text-green-500' : 'text-red-500'}`}>
                {data?.daily_change >= 0? '+' : ''}{data?.daily_change?.toFixed(2) || '0.00'} ({data?.daily_change_pct?.toFixed(2) || '0.00'}%)
              </div>
              <div className="text-xs text-gray-500">Ask: ${data?.ask_price?.toFixed(2)} | Spread: {data?.spread?.toFixed(2)}</div>
            </div>

            <div>
              <div className="text-gray-500 text-xs">◎ ACTIVE SIGNAL</div>
              <div className={`text-lg font-bold ${
                data?.active_signal?.status === 'BUY'? 'text-green-400' :
                data?.active_signal?.status === 'SELL'? 'text-red-400' : 'text-blue-400'
              }`}>
                {data?.active_signal?.status || 'NONE'}
              </div>
              {data?.active_signal?.status!== 'NONE' && (
                <>
                  <div className="text-xs text-gray-400">
                    {data?.active_signal?.source} · {data?.active_signal?.confidence}%
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <div className="flex justify-between">Entry: <span>${data?.active_signal?.entry?.toFixed(2)}</span></div>
                    <div className="flex justify-between">SL: <span className="text-red-400">${data?.active_signal?.sl?.toFixed(2)}</span></div>
                    <div className="flex justify-between">TP1: <span className="text-green-400">${data?.active_signal?.tp1?.toFixed(2)}</span></div>
                    {data?.active_signal?.tp2 && <div className="flex justify-between">TP2: <span className="text-green-400">${data?.active_signal?.tp2?.toFixed(2)}</span></div>}
                    {data?.active_signal?.tp3 && <div className="flex justify-between">TP3: <span className="text-green-400">${data?.active_signal?.tp3?.toFixed(2)}</span></div>}
                  </div>
                </>
              )}
            </div>

            <div>
              <div className="text-gray-500 text-xs">⚠ RISK ENGINE</div>
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between">Balance: <span>${data?.risk_engine?.balance?.toFixed(2) || '0.00'}</span></div>
                <div className="flex justify-between">Equity: <span>${data?.risk_engine?.equity?.toFixed(2) || '0.00'}</span></div>
                <div className="flex justify-between">Lot: <span>{data?.risk_engine?.lot_size?.toFixed(2) || '0.00'}</span></div>
                <div className="flex justify-between">DD: <span>{data?.risk_engine?.drawdown?.toFixed(1) || '0'}%</span></div>
                <div className={`font-medium ${
                  data?.risk_engine?.status === 'LOW RISK'? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {data?.risk_engine?.status || '---'}
                </div>
              </div>
            </div>

            <div>
              <div className="text-gray-500 text-xs">Win Rate</div>
              <div className="text-xl font-bold text-green-400">{data?.win_rate || '0'}%</div>
              <div className="text-xs text-gray-500">Total: {data?.total_trades || '0'} trades</div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}