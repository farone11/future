import { useEffect, useState, useRef } from 'react'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.faronecapital.online'
const WS_SIGNALS_URL = import.meta.env.VITE_WS_URL || 'wss://api.faronecapital.online'

interface Signal {
  id: number
  pair: string
  type: string
  entry: number
  sl: number
  tp1: number
  tp2?: number
  tp3?: number
  status: string
  source: string
  confidence: number
  pnl?: number
  exit_price?: number
  close_reason?: string
  closed_at?: string
  time?: string
  date?: string
}

interface MT5Trade {
  ticket: number
  date: string
  type: string
  volume: number
  price: number
  profit: number
  result: string
}

interface AnalyticsData {
  total_pl: number
  profit_factor: number
  avg_win: number
  avg_loss: number
  equity_curve: { date: string; equity: number; drawdown: number }[]
}

export default function History() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [mt5Trades, setMt5Trades] = useState<MT5Trade[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'AI' | 'MANUAL'>('ALL')
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const wsSignals = useRef<WebSocket | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [signalsRes, historyRes, analyticsRes] = await Promise.all([
        fetch(`${API_URL}/api/signals`),
        fetch(`${API_URL}/api/history?days=${days}`),
        fetch(`${API_URL}/api/analytics?days=${days}`)
      ])

      if (signalsRes.ok) {
        const data = await signalsRes.json()
        // FIX: Ambil array dari object
        const signalsArray = Array.isArray(data) ? data : (data.signals || [])
        setSignals(signalsArray)
      }

      if (historyRes.ok) {
        const data = await historyRes.json()
        const tradesArray = Array.isArray(data) ? data : (data.trades || [])
        setMt5Trades(tradesArray)
      }

      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json())
      }

    } catch (err: any) {
      console.error('Fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [days])

  // WebSocket real-time update
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null
    let isMounted = true

    const connectWS = () => {
      if (!isMounted) return
      wsSignals.current = new WebSocket(WS_SIGNALS_URL)

      wsSignals.current.onmessage = (event) => {
        if (!isMounted) return
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'signal_update' && msg.data.status === 'CLOSED') {
            // Tambah ke list kalo baru close
            setSignals(prev => {
              const exists = prev.find(s => s.id === msg.data.id)
              if (exists) {
                return prev.map(s => s.id === msg.data.id ? msg.data : s)
              }
              return [msg.data,...prev]
            })
          }
        } catch (e) {
          console.error('WS parse error:', e)
        }
      }

      wsSignals.current.onclose = () => {
        if (!isMounted) return
        reconnectTimeout = setTimeout(connectWS, 3000)
      }
    }

    connectWS()
    return () => {
      isMounted = false
      wsSignals.current?.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [])

  // Gabungin AI signals + MT5 trades
  const allTrades = [
   ...signals
      .filter(s => s.status === 'CLOSED' && s.pnl!== undefined)
      .map(s => ({
        id: s.id,
        date: s.closed_at || s.date || '',
        source: s.source,
        type: s.type,
        entry: s.entry,
        exit: s.exit_price || 0,
        pnl: s.pnl || 0,
        result: (s.pnl || 0) >= 0? 'WIN' : 'LOSS',
        reason: s.close_reason || '',
        isAI: s.source?.startsWith('AI-')
      })),
   ...mt5Trades.map(t => ({
      id: t.ticket,
      date: t.date,
      source: 'MT5',
      type: t.type,
      entry: t.price,
      exit: 0,
      pnl: t.profit,
      result: t.result,
      reason: 'MT5 Close',
      isAI: false
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Filter
  const filteredTrades = allTrades.filter(t => {
    if (filter === 'ALL') return true
    if (filter === 'WIN') return t.result === 'WIN'
    if (filter === 'LOSS') return t.result === 'LOSS'
    if (filter === 'AI') return t.isAI
    if (filter === 'MANUAL') return!t.isAI
    return true
  })

  // Stats
  const totalPL = filteredTrades.reduce((sum, t) => sum + t.pnl, 0)
  const wins = filteredTrades.filter(t => t.result === 'WIN')
  const losses = filteredTrades.filter(t => t.result === 'LOSS')
  const winRate = filteredTrades.length > 0? (wins.length / filteredTrades.length * 100) : 0
  const avgWin = wins.length > 0? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0
  const profitFactor = avgLoss > 0? avgWin / avgLoss : 0

  const exportCSV = () => {
    const headers = ['Date', 'Source', 'Type', 'Entry', 'Exit', 'PnL', 'Result', 'Reason']
    const rows = filteredTrades.map(t => [
      t.date, t.source, t.type, t.entry, t.exit, t.pnl, t.result, t.reason
    ])
    const csv = [headers,...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade_history_${days}days.csv`
    a.click()
  }

  return (
    <PageLayout
      title="TRADE HISTORY"
      subtitle="Performance log from AI Signals + MT5 Account · Institutional Audit"
      badge={`Total P/L: ${totalPL >= 0? '+' : ''}$${totalPL.toFixed(2)} | ${days} Days`}
      badgeColor={totalPL >= 0? 'text-green-400' : 'text-red-400'}
    >
      {error && (
        <div className="mb-4 px-3 py-2 border border-red-500/30 bg-red-500/5 rounded text-red-200/70 text-xs">
          <span className="text-red-400 font-semibold">ERROR:</span> {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <Card>
          <div className="text-gray-400 text-xs uppercase">TOTAL P/L</div>
          <div className={`text-2xl font-bold ${totalPL >= 0? 'text-green-400' : 'text-red-400'}`}>
            {totalPL >= 0? '+' : ''}${totalPL.toFixed(2)}
          </div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs uppercase">WIN RATE</div>
          <div className="text-cyan-400 text-2xl font-bold">{winRate.toFixed(1)}%</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs uppercase">PROFIT FACTOR</div>
          <div className="text-yellow-400 text-2xl font-bold">{profitFactor.toFixed(2)}</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs uppercase">AVG WIN</div>
          <div className="text-green-400 text-2xl font-bold">+${avgWin.toFixed(2)}</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs uppercase">AVG LOSS</div>
          <div className="text-red-400 text-2xl font-bold">-${avgLoss.toFixed(2)}</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs uppercase">TRADES</div>
          <div className="text-blue-400 text-2xl font-bold">{filteredTrades.length}</div>
        </Card>
      </div>

      {/* Equity Curve */}
      <Card className="mb-4">
        <div className="text-yellow-400 font-semibold text-sm mb-3">Equity Curve</div>
        {analytics?.equity_curve && analytics.equity_curve.length > 0? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analytics.equity_curve}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#666" />
              <YAxis tick={{ fontSize: 10 }} stroke="#666" />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                labelStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-500 text-sm h-32 flex items-center justify-center">
            No equity data yet
          </div>
        )}
      </Card>

      {/* Trades Table */}
      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="text-yellow-400 font-semibold text-sm">Closed Trades Detail</div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-[#1e1e24] border border-[#3f3f46] rounded px-2 py-1 text-xs"
            >
              <option value={7}>7 Days</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
              <option value={365}>1 Year</option>
            </select>
            {['ALL', 'WIN', 'LOSS', 'AI', 'MANUAL'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-2 py-1 rounded text-xs ${
                  filter === f? 'bg-yellow-500/20 text-yellow-400' : 'bg-[#1e1e24] text-gray-400'
                }`}
              >
                {f}
              </button>
            ))}
            <button
              onClick={exportCSV}
              className="px-2 py-1 rounded text-xs bg-green-600/20 text-green-400 flex items-center gap-1"
            >
              <Download size={12} /> CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e1e24] text-gray-400">
                <th className="text-left py-2 px-2">DATE</th>
                <th className="text-left py-2 px-2">SOURCE</th>
                <th className="text-left py-2 px-2">TYPE</th>
                <th className="text-right py-2 px-2">ENTRY</th>
                <th className="text-right py-2 px-2">EXIT</th>
                <th className="text-right py-2 px-2">PNL</th>
                <th className="text-center py-2 px-2">RESULT</th>
                <th className="text-left py-2 px-2">REASON</th>
              </tr>
            </thead>
            <tbody>
              {loading? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">Loading...</td>
                </tr>
              ) : filteredTrades.length === 0? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">No trades found.</td>
                </tr>
              ) : (
                filteredTrades.map(trade => (
                  <tr key={trade.id} className="border-b border-[#1e1e24] hover:bg-[#1e1e24]/50">
                    <td className="py-2 px-2 text-gray-300">{trade.date}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        trade.isAI? 'bg-blue-600/20 text-blue-400' : 'bg-gray-600/20 text-gray-400'
                      }`}>
                        {trade.source}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`font-semibold ${
                        trade.type === 'BUY'? 'text-green-400' : 'text-red-400'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-white">${trade.entry.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right text-white">${trade.exit.toFixed(2)}</td>
                    <td className={`py-2 px-2 text-right font-bold ${
                      trade.pnl >= 0? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trade.pnl >= 0? '+' : ''}${trade.pnl.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {trade.result === 'WIN'? (
                        <TrendingUp size={16} className="text-green-400 mx-auto" />
                      ) : (
                        <TrendingDown size={16} className="text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{trade.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageLayout>
  )
}
