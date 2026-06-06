import { useEffect, useState, useRef, useMemo } from 'react'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { TrendingUp, TrendingDown, Activity, Wifi, WifiOff, AlertTriangle } from 'lucide-react'

// Gak pake fallback localhost biar ketahuan kalo env gagal
const API_URL = import.meta.env.VITE_API_URL
const WS_URL = import.meta.env.VITE_WS_URL
const WS_SIGNALS_URL = import.meta.env.VITE_WS_SIGNALS_URL || WS_URL?.replace('/ws/live', '/ws/signals')

if (!API_URL ||!WS_URL) {
  console.error('ENV GAGAL: VITE_API_URL atau VITE_WS_URL tidak ke-set di Cloudflare Pages')
}

interface DashboardData {
  ai_status: string
  gold_price: number
  ask_price?: number
  spread?: number
  daily_change: number
  daily_change_pct: number
  win_rate: number
  total_trades: number
  active_signal: {
    id?: number
    status: 'BUY' | 'SELL' | 'NONE' | 'WAITING' | 'ACTIVE' | 'TRIGGERED' | 'CLOSED'
    entry: number
    sl: number
    tp1: number
    tp2?: number
    tp3?: number
    rr?: number
    confidence?: number
    source?: string
    time?: string
    current_price?: number
    pnl?: number
  }
  risk_engine: {
    lot_size: number
    drawdown: number
    max_daily_dd: number
    status: string
    kill_switch: boolean
    balance: number
    equity: number
    margin?: number
    free_margin?: number
  }
  open_positions?: number
  updated_at: string
  updated_date?: string
  data_source?: string
  error?: string
}

interface AnalyticsData {
  profit_factor: number
  max_dd_pct: number
  max_drawdown?: number
  sharpe_ratio: number
  sortino_ratio: number
  expectancy: number
  recovery_factor: number
  total_pl: number
  equity_curve: { date: string; equity: number; drawdown: number }[]
}

interface SettingsData {
  ai_modules: { smc: boolean; prz: boolean; liquidity: boolean; risk_ai: boolean }
}

function EquityChart({ data }: { data: AnalyticsData['equity_curve'] }) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-sm h-32 flex items-center justify-center">No equity data yet</div>
  }

  const equities = data.map(d => d.equity)
  const minEquity = Math.min(...equities)
  const maxEquity = Math.max(...equities)
  const padding = (maxEquity - minEquity) * 0.1 || 100

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis domain={[minEquity - padding, maxEquity + padding]} hide />
        <Tooltip
          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', fontSize: '12px' }}
          labelStyle={{ color: '#fff' }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
        />
        <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function SkeletonCard() {
  return (
    <Card className="col-span-1 animate-pulse">
      <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
      <div className="h-7 bg-gray-700 rounded w-3/4 mb-1"></div>
      <div className="h-3 bg-gray-700 rounded w-1/3"></div>
    </Card>
  )
}

export default function Dashboard() {
  const [time, setTime] = useState(new Date())
  const [data, setData] = useState<DashboardData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const wsLive = useRef<WebSocket | null>(null)
  const wsSignals = useRef<WebSocket | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!API_URL) {
      setError('VITE_API_URL tidak ke-set. Cek Cloudflare Pages Environment Variables')
      setLoading(false)
      return
    }

    abortControllerRef.current = new AbortController()
    const fetchAll = async () => {
      try {
        const [settingsRes, analyticsRes, dashboardRes] = await Promise.all([
          fetch(`${API_URL}/api/settings`, { signal: abortControllerRef.current?.signal }),
          fetch(`${API_URL}/api/analytics?days=30`, { signal: abortControllerRef.current?.signal }),
          fetch(`${API_URL}/api/dashboard`, { signal: abortControllerRef.current?.signal })
        ])

        if (settingsRes.ok) setSettings(await settingsRes.json())
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
        if (dashboardRes.ok) {
          const dashData = await dashboardRes.json()
          setData(dashData)
          if (dashData.error) setError(dashData.error)
        }

      } catch (err: any) {
        if (err.name!== 'AbortError') {
          console.error('Fetch error:', err)
          setError(`Backend unreachable: ${API_URL}`)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
    return () => abortControllerRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!WS_URL) return
    let reconnectTimeout: NodeJS.Timeout | null = null
    let reconnectAttempts = 0
    let isMounted = true

    const connectWS = () => {
      if (!isMounted) return
      wsLive.current = new WebSocket(WS_URL)

      wsLive.current.onopen = () => {
        if (!isMounted) return
        setError(null)
        setWsConnected(true)
        reconnectAttempts = 0
      }

      wsLive.current.onmessage = (event) => {
        if (!isMounted) return
        try {
          const liveData = JSON.parse(event.data)
          setData(prev => {
            if (liveData.risk_engine?.kill_switch &&!prev?.risk_engine?.kill_switch) {
              toast.error('🚨 KILL SWITCH TRIGGERED', { duration: 10000 })
            }
            return {...prev,...liveData }
          })
        } catch (e) {
          console.error('WS parse error:', e)
        }
      }

      wsLive.current.onerror = () => {
        if (!isMounted) return
        setWsConnected(false)
      }

      wsLive.current.onclose = () => {
        if (!isMounted) return
        setWsConnected(false)
        reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
        reconnectTimeout = setTimeout(connectWS, delay)
      }
    }

    connectWS()
    return () => {
      isMounted = false
      wsLive.current?.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [])

  useEffect(() => {
    if (!WS_SIGNALS_URL) return
    let reconnectTimeout: NodeJS.Timeout | null = null
    let isMounted = true

    const connectSignalsWS = () => {
      if (!isMounted) return
      wsSignals.current = new WebSocket(WS_SIGNALS_URL)

      wsSignals.current.onmessage = (event) => {
        if (!isMounted) return
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'signal_update') {
            const updatedSignal = msg.data
            setData(prev => {
              if (!prev) return prev
              if (prev.active_signal?.id === updatedSignal.id || prev.active_signal?.entry === updatedSignal.entry) {
                if (updatedSignal.status === 'ACTIVE' && prev.active_signal?.status === 'WAITING') {
                  toast.success(`🎯 Signal TRIGGERED: ${updatedSignal.type} @ ${updatedSignal.entry}`)
                } else if (updatedSignal.status.includes('HIT')) {
                  toast.success(`✅ ${updatedSignal.status}: PnL $${updatedSignal.pnl?.toFixed(2)}`)
                }
                return {...prev, active_signal: {...prev.active_signal,...updatedSignal } }
              }
              return prev
            })
          }
        } catch (e) {
          console.error('Signals WS parse error:', e)
        }
      }

      wsSignals.current.onclose = () => {
        if (!isMounted) return
        reconnectTimeout = setTimeout(connectSignalsWS, 3000)
      }
    }

    connectSignalsWS()
    return () => {
      isMounted = false
      wsSignals.current?.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [])

  const timeStr = time.toLocaleTimeString('en-US', { hour12: false })
  const dateStr = time.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })

  const killSwitchActive = data?.risk_engine?.kill_switch || false
  const aiModules = settings?.ai_modules || { smc: false, prz: false, liquidity: false, risk_ai: false }

  const AI_PANEL = useMemo(() => [
    { model: 'SMC Engine', status: aiModules.smc? 'Active' : 'Off', color: aiModules.smc? 'text-green-400' : 'text-gray-500' },
    { model: 'PRZ Scanner', status: aiModules.prz? 'Scanning' : 'Off', color: aiModules.prz? 'text-blue-400' : 'text-gray-500' },
    { model: 'Liquidity Sweep', status: aiModules.liquidity? 'Monitoring' : 'Off', color: aiModules.liquidity? 'text-cyan-400' : 'text-gray-500' },
    { model: 'Risk AI', status: aiModules.risk_ai? 'Protected' : 'Off', color: aiModules.risk_ai? 'text-green-400' : 'text-red-400' },
  ], [aiModules])

  const activeSignal = data?.active_signal
  const hasActiveSignal = activeSignal && activeSignal.status!== 'NONE' && activeSignal.entry > 0
  const spread = data?.spread || (data?.ask_price && data?.gold_price? data.ask_price - data.gold_price : 0)

  if (!API_URL) {
    return (
      <PageLayout title="ERROR" subtitle="Configuration Missing">
        <Card className="border-red-500/50">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={20} />
            <div>
              <div className="font-bold">VITE_API_URL tidak ke-set</div>
              <div className="text-sm text-gray-400 mt-1">Buka Cloudflare Pages → Settings → Environment Variables → Add Production: VITE_API_URL = https://api.faronecapital.online</div>
            </div>
          </div>
        </Card>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="FUTURISTIC GOLD TRADING ANALYTICS"
      subtitle={`Institutional Intelligence Layer · XAUUSD Analytics · ${data?.data_source || 'Loading'}`}
      badge={
        <div className="flex items-center gap-2">
          {wsConnected? <Wifi size={14} className="text-green-400" /> : <WifiOff size={14} className="text-red-400" />}
          {wsConnected? 'Live WS' : 'Reconnecting'} | Bias: {activeSignal?.status || 'LOADING'} | {timeStr}
        </div>
      }
      badgeColor={error? 'text-red-400' : killSwitchActive? 'text-red-400' : 'text-green-400'}
    >
      {killSwitchActive && (
        <div className="mb-4 px-3 py-2 border border-red-500/50 bg-red-500/10 rounded text-red-200 text-sm animate-pulse">
          <span className="text-red-400 font-bold">🚨 KILL SWITCH ACTIVE:</span> Max Daily DD {data?.risk_engine?.max_daily_dd}% reached. Trading stopped automatically.
        </div>
      )}

      {error &&!wsConnected && (
        <div className="mb-4 px-3 py-2 border border-red-500/30 bg-red-500/5 rounded text-red-200/70 text-xs">
          <span className="text-red-400 font-semibold">ERROR:</span> {error}
        </div>
      )}

      <div className="mb-4 px-3 py-2 border border-yellow-500/30 bg-yellow-500/5 rounded text-yellow-200/70 text-xs">
        <span className="text-yellow-400 font-semibold">DISCLAIMER:</span> This dashboard is for informational and educational purposes only. Trading forex, CFDs, and gold involves substantial risk of loss and is not suitable for every investor. Past performance is not indicative of future results. AI signals are not financial advice.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
        {loading? Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />) : (
          <>
            <Card className="col-span-1">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">XAUUSD PRICE</div>
              <div className="text-yellow-400 text-2xl font-bold">
                ${data?.gold_price?.toFixed(2) || '0.00'}
              </div>
              <div className="flex items-center justify-between text-gray-500 text-xs mt-1">
                <div className="flex items-center gap-1">
                  {(data?.daily_change || 0) >= 0? <TrendingUp size={12} className="text-green-400" /> : <TrendingDown size={12} className="text-red-400" />}
                  {(data?.daily_change || 0) >= 0? '+' : ''}{data?.daily_change?.toFixed(2) || '0.00'}
                </div>
                <span className="text-gray-600">Spread: {spread.toFixed(2)}</span>
              </div>
            </Card>

            <Card className="col-span-1">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">WIN RATE</div>
              <div className="text-green-400 text-2xl font-bold">
                {data?.win_rate || 0}%
              </div>
              <div className="text-gray-500 text-xs mt-1">Total: {data?.total_trades || 0} trades</div>
            </Card>

            <Card className="col-span-1">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">PROFIT FACTOR</div>
              <div className="text-green-400 text-2xl font-bold">
                {analytics?.profit_factor?.toFixed(2) || '0.00'}
              </div>
              <div className="text-gray-500 text-xs mt-1">PF {'>'} 1.5 = Good</div>
            </Card>

            <Card className="col-span-1">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">MAX DD</div>
              <div className="text-red-400 text-2xl font-bold">
                {analytics?.max_dd_pct?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-gray-500 text-xs mt-1">${analytics?.max_drawdown?.toFixed(0) || 0}</div>
            </Card>

            <Card className="col-span-1">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">SHARPE</div>
              <div className="text-blue-400 text-2xl font-bold">
                {analytics?.sharpe_ratio?.toFixed(2) || '0.00'}
              </div>
              <div className="text-gray-500 text-xs mt-1">{'>'} 1.0 = Institutional</div>
            </Card>

            <Card className="col-span-1">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">DAILY DD</div>
              <div className={`text-2xl font-bold ${killSwitchActive? 'text-red-400' : 'text-cyan-400'}`}>
                {data?.risk_engine?.drawdown?.toFixed(1) || '0.0'}%
              </div>
              <div className={`text-xs mt-1 ${data?.risk_engine?.status === 'LOW RISK'? 'text-green-400' : 'text-red-400'}`}>
                Limit: {data?.risk_engine?.max_daily_dd || 5}%
              </div>
            </Card>

            <Card className="col-span-1">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">POSITIONS</div>
              <div className="text-blue-400 text-2xl font-bold">
                {data?.open_positions || 0}
              </div>
              <div className="text-gray-500 text-xs mt-1">Lot: {data?.risk_engine?.lot_size?.toFixed(2) || '0.00'}</div>
            </Card>

            <Card className="col-span-1">
              <div className="flex items-center justify-between mb-1">
                <div className="text-gray-400 text-xs uppercase tracking-widest">AI STATUS</div>
                <span className={`text-xs ${killSwitchActive? 'text-red-400' : 'text-green-400'} border ${killSwitchActive? 'border-red-400/50' : 'border-green-400/50'} px-1 rounded`}>
                  {killSwitchActive? 'Stop' : 'Live'}
                </span>
              </div>
              <div className={`text-xl font-bold ${killSwitchActive? 'text-red-400' : 'text-green-400'}`}>
                {data?.ai_status || 'STANDBY'}
              </div>
              <div className="text-gray-500 text-xs mt-1">Equity: ${data?.risk_engine?.equity?.toFixed(0) || '0'}</div>
            </Card>
          </>
        )}
      </div>

      {hasActiveSignal && (
        <Card className="mb-4 border-yellow-500/50">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Activity size={16} className="text-yellow-400" />
              <div className="text-yellow-400 font-semibold text-sm">ACTIVE SIGNAL</div>
              {activeSignal?.source && (
                <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                  {activeSignal.source}
                </span>
              )}
              {activeSignal?.confidence && (
                <span className="text-xs px-2 py-0.5 bg-blue-600/20 rounded text-blue-400">
                  {activeSignal.confidence}% Confidence
                </span>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded border ${
              activeSignal?.status === 'BUY'? 'bg-green-600/20 text-green-400 border-green-400/50' :
              activeSignal?.status === 'SELL'? 'bg-red-600/20 text-red-400 border-red-400/50' :
              'bg-yellow-600/20 text-yellow-400 border-yellow-400/50'
            }`}>
              {activeSignal?.status}
            </span>
          </div>

          <div className={`grid grid-cols-2 md:grid-cols-${activeSignal?.tp3? '6' : activeSignal?.tp2? '5' : '4'} gap-4 text-sm`}>
            <div>
              <div className="text-gray-400 text-xs mb-1">Entry</div>
              <div className="text-white font-bold">${activeSignal?.entry?.toFixed(2) || '0.00'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Stop Loss</div>
              <div className="text-red-400 font-bold">${activeSignal?.sl?.toFixed(2) || '0.00'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">TP1</div>
              <div className="text-green-400 font-bold">${activeSignal?.tp1?.toFixed(2) || '0.00'}</div>
            </div>
            {activeSignal?.tp2 && activeSignal?.tp2!== activeSignal?.tp1 && (
              <div>
                <div className="text-gray-400 text-xs mb-1">TP2</div>
                <div className="text-green-400 font-bold">${activeSignal?.tp2?.toFixed(2)}</div>
              </div>
            )}
            {activeSignal?.tp3 && (
              <div>
                <div className="text-gray-400 text-xs mb-1">TP3</div>
                <div className="text-green-400 font-bold">${activeSignal?.tp3?.toFixed(2)}</div>
              </div>
            )}
            <div>
              <div className="text-gray-400 text-xs mb-1">R:R</div>
              <div className="text-white font-bold">1:{activeSignal?.rr?.toFixed(1) || '0.0'}</div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1e1e24]">
            {activeSignal?.time && (
              <div className="text-xs text-gray-500">Signal Time: {activeSignal.time}</div>
            )}
            {activeSignal?.current_price && (
              <div className="text-xs text-gray-400">
                Current: <span className="text-yellow-400 font-bold">${activeSignal.current_price.toFixed(2)}</span>
                {activeSignal?.pnl!== undefined && activeSignal?.pnl!== null && (
                  <span className={`ml-2 ${activeSignal.pnl >= 0? 'text-green-400' : 'text-red-400'}`}>
                    PnL: {activeSignal.pnl >= 0? '+' : ''}${activeSignal.pnl.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-yellow-400 font-semibold text-sm">Equity Curve - Last 30 Days</div>
            <div className="text-xs text-gray-400">
              Recovery: <span className="text-green-400">{analytics?.recovery_factor?.toFixed(2) || '0.00'}</span> |
              Sortino: <span className="text-blue-400">{analytics?.sortino_ratio?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
          <EquityChart data={analytics?.equity_curve || []} />
          <div className="w-full mt-3" style={{ height: 280 }}>
            <iframe
              src="https://www.tradingview.com/widgetembed/?frameElementId=tradingview&symbol=OANDA%3AXAUUSD&interval=60&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=1&saveimage=1&toolbarbg=1e1e24&studies=[]&theme=dark&style=1&timezone=exchange&withdateranges=1&showpopupbutton=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en"
              className="w-full h-full rounded border border-[#1e1e24]"
              scrolling="no"
              allowFullScreen
            />
          </div>
        </Card>

        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-4">AI Execution Panel</div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-3 border-b border-[#1e1e24] pb-2">
            <span>Model</span>
            <span>Status</span>
          </div>
          <div className="flex flex-col gap-3">
            {AI_PANEL.map((item) => (
              <div key={item.model} className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{item.model}</span>
                <span className={`text-sm font-semibold ${item.color}`}>{item.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-[#1e1e24] text-xs text-gray-500 space-y-1">
            <div>Expectancy: <span className="text-green-400">${analytics?.expectancy?.toFixed(2) || '0.00'}</span></div>
            <div>Total P/L: <span className="text-yellow-400">${analytics?.total_pl?.toFixed(2) || '0.00'}</span></div>
            <div>Last Update: {data?.updated_at || timeStr}</div>
            <div>Server: {dateStr}</div>
            <div>Source: <span className="text-cyan-400">{data?.data_source || 'NONE'}</span></div>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}
