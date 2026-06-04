import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Signal, History, Settings, ChevronLeft } from 'lucide-react'

export default function Sidebar() {
  const [data, setData] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const fetchData = () => {
      fetch('http://localhost:5400/api/dashboard')
        .then(res => res.json())
        .then(setData)
        .catch(err => console.log('API Error:', err))
    }
    
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Signal, label: 'Signals', path: '/signals' },
    { icon: History, label: 'History', path: '/history' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ]

  return (
    <div className={`${collapsed ? 'w-20' : 'w-64'} bg-zinc-900 h-screen p-4 text-white transition-all duration-300 border-r border-zinc-800 flex flex-col`}>
      
      {/* Header + Logo */}
      <div className="flex items-center justify-between mb-8">
        {!collapsed && (
          <div className="flex items-center gap-2">
            {/* GANTI INI KALAU LOGO UDAH ADA: <img src="/logo.png" className="w-8 h-8 rounded-full" /> */}
            <img 
  src="/Logo.png" 
  alt="FARONE.AI" 
  className="w-8 h-8 object-contain"
/>
            <span className="font-bold text-lg">FARONE.AI</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 hover:bg-zinc-800 rounded">
          <ChevronLeft className={`w-5 h-5 transition-transform ${collapsed && 'rotate-180'}`} />
        </button>
      </div>

      {/* Menu Navigasi */}
      <nav className="mb-8">
        {menuItems.map((item) => (
          <div
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-3 p-3 rounded-lg mb-2 cursor-pointer ${
              location.pathname === item.path ? 'bg-yellow-500/20 text-yellow-400' : 'hover:bg-zinc-800 text-gray-400'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </div>
        ))}
      </nav>

      {/* Data dari API - Hilang kalau collapsed */}
      {!collapsed && (
        <div className="text-sm space-y-4 border-t border-zinc-800 pt-4 overflow-y-auto">
          <div>
            <div className="text-xs text-gray-500">AI Signal Center</div>
            <div className="text-lg font-bold text-green-400">
              {data?.ai_status || 'STANDBY'}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Gold Price</div>
            <div className="text-2xl font-bold">${data?.gold_price || '0.00'}</div>
            <div className={data?.daily_change >= 0 ? 'text-green-500' : 'text-red-500'}>
              {data?.daily_change >= 0 ? '+' : ''}{data?.daily_change || '0.00'}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Active Signal</div>
            <div className="text-lg font-bold text-blue-400">
              {data?.active_signal?.status || '---'}
            </div>
            <div>Entry: {data?.active_signal?.entry || '0.00'}</div>
            <div>SL: {data?.active_signal?.sl || '0.00'}</div>
            <div>TP1: {data?.active_signal?.tp1 || '0.00'}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Risk Engine</div>
            <div>Lot: {data?.risk_engine?.lot_size || '0.00'}</div>
            <div>DD: {data?.risk_engine?.drawdown || '0'}%</div>
            <div className="text-green-400 font-medium">{data?.risk_engine?.status || '---'}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Win Rate</div>
            <div className="text-xl font-bold">{data?.win_rate || '0'}%</div>
            <div className="text-xs text-gray-500">Total: {data?.total_trades || '0'} trades</div>
          </div>
        </div>
      )}
    </div>
  )
}