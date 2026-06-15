import { useEffect, useState, useRef, useMemo } from 'react'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import { api, ApiStatus } from '../services/api'
import toast from 'react-hot-toast'

interface Signal {
  id: number
  pair: string
  type: string
  entry: number
  sl: number
  tp: number
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
  order?: number
  position_id?: number
  date: string
  time?: number
  type: string
  volume: number
  price: number
  price_open: number
  profit: number
  commission: number
  swap: number
  result: string
  reason: string
  symbol?: string
}

interface AnalyticsData {
  total_pl: number
  profit_factor: number
  avg_win: number
  avg_loss: number
  equity_curve: { date: string; equity: number; drawdown: number }[]
}

interface UnifiedTrade {
  id: string | number
  date: string
  source: string
  type: string
  entry: number
  exit: number
  volume: number
  pnl: number
  commission: number
  swap: number
  result: string
  reason: string
  isAI: boolean
}

export default function History() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [mt5Trades, setMt5Trades] = useState<MT5Trade[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'AI' | 'MANUAL' | 'SL' | 'TP'>('ALL')
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('LIVE')
  const abortRef = useRef<AbortController>()

  const fetchData = async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    
    try {
      setLoading(true)
      
      const [signalsData, historyData, analyticsData] = await Promise.allSettled([
        api.get<{signals: Signal[]}>('/api/signals'),
        api.get<{deals: MT5Trade[]}>(`/api/mt5-history?days=${days}`),
        api.get<AnalyticsData>(`/api/analytics?days=${days}`)
      ])

      if (signalsData.status === 'fulfilled') {
        const data = signalsData.value
        setSignals(Array.isArray(data)? data : (data?.signals || []))
      }

      if (historyData.status === 'fulfilled') {
        const data = historyData.value
        setMt5Trades(Array.isArray(data)? data : (data?.deals || []))
        setApiStatus('LIVE')
      } else {
        console.error('[HISTORY] Failed:', historyData.reason)
        setApiStatus('ERROR')
        toast.error('MT5 History API failed')
      }

      if (analyticsData.status === 'fulfilled') {
        setAnalytics(analyticsData.value)
      }

    } catch (err: any) {
      if (err.name!== 'AbortError') {
        console.error('Fetch error:', err)
        setApiStatus('ERROR')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => {
      clearInterval(interval)
      abortRef.current?.abort()
    }
  }, [days])

  // FIX: Kasih default value semua field + safe sort
  const allTrades: UnifiedTrade[] = useMemo(() => [
  ...signals
    .filter(s => s?.status === 'CLOSED' && s?.pnl!== undefined)
    .map(s => ({
        id: `ai-${s.id?? Date.now()}`,
        date: s.closed_at || s.date || '',
        source: s.source || 'AI',
        type: s.type || '',
        entry: Number(s.entry) || 0,
        exit: Number(s.exit_price) || 0,
        volume: 0,
        pnl: Number(s.pnl) || 0,
        commission: 0,
        swap: 0,
        result: (Number(s.pnl) || 0) >= 0? 'WIN' : 'LOSS',
        reason: s.close_reason || '',
        isAI: true
      })),
  ...mt5Trades.map(t => ({
      id: `mt5-${t.ticket?? Date.now()}`,
      date: t.date || '',
      source: 'MT5',
      type: t.type || '',
      entry: Number(t.price_open) || 0,
      exit: Number(t.price) || 0,
      volume: Number(t.volume) || 0,
      pnl: Number(t.profit) || 0,
      commission: Number(t.commission) || 0,
      swap: Number(t.swap) || 0,
      result: t.result || '',
      reason: t.reason || 'Manual',
      isAI: false
    }))
  ].sort((a, b) => {
    const da = new Date(a.date).getTime()
    const db = new Date(b.date).getTime()
    return (isNaN(db)? 0 : db) - (isNaN(da)? 0 : da)
  }), [signals, mt5Trades])

  const filteredTrades = useMemo(() => allTrades.filter(t => {
    const net = t.pnl + t.commission + t.swap
    if (filter === 'ALL') return true
    if (filter === 'WIN') return net > 0
    if (filter === 'LOSS') return net < 0
    if (filter === 'AI') return t.isAI
    if (filter === 'MANUAL') return!t.isAI
    if (filter === 'SL') return t.reason === 'SL'
    if (filter === 'TP') return t.reason === 'TP'
    return true
  }), [allTrades, filter])

  const { totalPL, wins, losses, winRate, avgWin, avgLoss, profitFactor } = useMemo(() => {
    const totalPL = filteredTrades.reduce((sum, t) => sum + t.pnl + t.commission + t.swap, 0)
    const wins = filteredTrades.filter(t => (t.pnl + t.commission + t.swap) > 0)
    const losses = filteredTrades.filter(t => (t.pnl + t.commission + t.swap) < 0)
    const winRate = filteredTrades.length > 0? (wins.length / filteredTrades.length * 100) : 0
    const avgWin = wins.length > 0? wins.reduce((sum, t) => sum + t.pnl + t.commission + t.swap, 0) / wins.length : 0
    const avgLoss = losses.length > 0? Math.abs(losses.reduce((sum, t) => sum + t.pnl + t.commission + t.swap, 0) / losses.length) : 0
    const profitFactor = avgLoss > 0? avgWin / avgLoss : 0
    return { totalPL, wins, losses, winRate, avgWin, avgLoss, profitFactor }
  }, [filteredTrades])

  const exportCSV = () => {
    const headers = ['Date', 'Source', 'Type', 'Entry', 'Exit', 'Volume', 'PnL', 'Commission', 'Swap', 'Net', 'Result', 'Reason']
    const rows = filteredTrades.map(t => {
      const net = t.pnl + t.commission + t.swap
      return [
        t.date, t.source, t.type, 
        t.entry.toFixed(2), t.exit.toFixed(2), t.volume.toFixed(2),
        t.pnl.toFixed(2), t.commission.toFixed(2), t.swap.toFixed(2),
        net.toFixed(2), t.result, t.reason
      ]
    })
    const csv = [headers,...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade_history_${days}days.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatPrice = (price: number) => price > 0? `$${price.toFixed(2)}` : '-'
  const safeNum = (n: any) => Number(n) || 0

  return (
    <PageLayout
      title="TRADE HISTORY"
      subtitle="Performance log from AI Signals + MT5 Account · Institutional Audit"
      badge={`Total P/L: ${totalPL >= 0? '+' : ''}$${totalPL.toFixed(2)} | ${days} Days`}
      badgeColor={totalPL >= 0? 'text-green-400' : 'text-red-400'}
    >
      {apiStatus === 'ERROR' && (
        <div className="mb-4 px-3 py-2 border border-red-500/30 bg-red-500/5 rounded text-red-200/70 text-xs">
          <span className="text-red-400 font-semibold">ERROR:</span> API unavailable. Showing cached data.
        </div>
      )}

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
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }} />
              <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-500 text-sm h-32 flex items-center justify-center">
            No equity data yet
          </div>
        )}
      </Card>

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
            {['ALL', 'WIN', 'LOSS', 'SL', 'TP', 'AI', 'MANUAL'].map(f => (
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
            <button onClick={exportCSV} className="px-2 py-1 rounded text-xs bg-green-600/20 text-green-400 flex items-center gap-1">
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
                <th className="text-right py-2 px-2">LOT</th>
                <th className="text-right py-2 px-2">PNL</th>
                <th className="text-right py-2 px-2">COMM</th>
                <th className="text-right py-2 px-2">SWAP</th>
                <th className="text-right py-2 px-2">NET</th>
                <th className="text-center py-2 px-2">RESULT</th>
                <th className="text-left py-2 px-2">REASON</th>
              </tr>
            </thead>
            <tbody>
              {loading? (
                <tr><td colSpan={12} className="text-center py-8 text-gray-500">Loading...</td></tr>
              ) : filteredTrades.length === 0? (
                <tr><td colSpan={12} className="text-center py-8 text-gray-500">No trades found.</td></tr>
              ) : (
                filteredTrades.map(trade => {
                  const netPL = safeNum(trade.pnl) + safeNum(trade.commission) + safeNum(trade.swap)
                  return (
                    <tr key={trade.id} className="border-b border-[#1e1e24] hover:bg-[#1e1e24]/50">
                      <td className="py-2 px-2 text-gray-300">{trade.date || '-'}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${trade.isAI? 'bg-blue-600/20 text-blue-400' : 'bg-gray-600/20 text-gray-400'}`}>
                          {trade.source}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`font-semibold ${trade.type === 'BUY'? 'text-green-400' : 'text-red-400'}`}>
                          {trade.type}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-white">{formatPrice(safeNum(trade.entry))}</td>
                      <td className="py-2 px-2 text-right text-white">{formatPrice(safeNum(trade.exit))}</td>
                      <td className="py-2 px-2 text-right text-gray-400">{safeNum(trade.volume).toFixed(2)}</td>
                      <td className={`py-2 px-2 text-right ${safeNum(trade.pnl) >= 0? 'text-green-400' : 'text-red-400'}`}>
                        {safeNum(trade.pnl) >= 0? '+' : ''}${safeNum(trade.pnl).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-400">${safeNum(trade.commission).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-400">${safeNum(trade.swap).toFixed(2)}</td>
                      <td className={`py-2 px-2 text-right font-bold ${netPL >= 0? 'text-green-400' : 'text-red-400'}`}>
                        {netPL >= 0? '+' : ''}${netPL.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {trade.result === 'WIN'? <TrendingUp size={16} className="text-green-400 mx-auto" /> : <TrendingDown size={16} className="text-red-400 mx-auto" />}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          trade.reason === 'SL'? 'bg-red-600/20 text-red-400' : 
                          trade.reason === 'TP'? 'bg-green-600/20 text-green-400' : 
                          'bg-gray-600/20 text-gray-400'
                        }`}>
                          {trade.reason || '-'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageLayout>
  )
}
