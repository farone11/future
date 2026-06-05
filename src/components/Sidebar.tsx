import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Signal, History, Settings, ChevronLeft, Menu, X } from 'lucide-react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:5400/ws/live'

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
  const navigate = useNavigate()
  const location = useLocation()

  // AUTO COLLAPSE DI < 1024px, EXPAND DI DESKTOP
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

  // WEBSOCKET REALTIME
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    ws.onmessage = (event) => {
      try {
        const liveData = JSON.parse(event.data)
        setData(prev => ({...prev,...liveData }))
      } catch (e) {}
    }
    return () => ws.close()
  }, [])

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Signal, label: 'Signals', path: '/signals' },
    { icon: History, label: 'History', path: '/history' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ]

  const handleNavigate = (path: string) => {
    navigate(path)
    if (window.innerWidth < 1024) setIsMobileOpen(false)
  }

  return (
    <>
      {/* TOMBOL HAMBURGER MOBILE */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-white"
      >
        {isMobileOpen? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* OVERLAY MOBILE */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-[55]"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed lg:static top-0 left-0 h-screen bg-zinc-900 border-r border-zinc-800
        transition-all duration-300 z-[56] flex flex-col font-sans
        ${isCollapsed &&!isMobileOpen? 'w-20' : 'w-64'}
        ${isMobileOpen? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* HEADER */}
        <div className="flex items-center justify-between p-4 h-16 border-b border-zinc-800 flex-shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="FARONE.AI" 
                className="w-8 h-8 object-contain" 
                onError={(e) => e.currentTarget.style.display = 'none'} 
              />
              <div>
                <div className="font-bold text-sm text-white">FARONE.AI</div>
                <div className="text-xs text-gray-500">SMC ENGINE</div>
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

        {/* MENU */}
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

        {/* DATA - HILANG KALO COLLAPSE */}
        {!isCollapsed && (
          <div className="p-4 text-xs space-y-3 border-t border-zinc-800 overflow-y-auto flex-1">
            <div>
              <div className="text-gray-500 flex items-center gap-1 text-xs">
                <Signal size={12} /> AI SIGNAL CENTER
              </div>
              <div className={`text-lg font-bold ${
                data?.ai_status === 'ACTIVE'? 'text-green-400' :
                data?.ai_status === 'KILL SWITCH'? 'text-red-400' : 'text-gray-400'
              }`}>
                {data?.ai_status || 'STANDBY'}
              </div>
            </div>

            <div>
              <div className="text-gray-500 text-xs">$ GOLD PRICE</div>
              <div className="text-2xl font-bold text-yellow-400">
                ${data?.gold_price?.toFixed(2) || '0.00'}
              </div>
              <div className={`text-xs ${data?.daily_change >= 0? 'text-green-500' : 'text-red-500'}`}>
                {data?.daily_change >= 0? '+' : ''}{data?.daily_change?.toFixed(2) || '0.00'}
              </div>
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