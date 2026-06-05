import { useEffect, useState } from 'react'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5400'

export default function Analytics() {
  const [data, setData] = useState<any>(null)
  
  useEffect(() => {
    fetch(`${API_URL}/api/analytics?days=90`)
      .then(res => res.json())
      .then(setData)
  }, [])

  if (!data) return <div className="p-6">Loading analytics...</div>

  return (
    <PageLayout
      title="INSTITUTIONAL ANALYTICS"
      subtitle="90-Day Performance Audit · Sharpe · Sortino · Recovery Factor"
      badge={`Total P/L: $${data.total_pl}`}
      badgeColor="text-green-400"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card>
          <div className="text-gray-400 text-xs">SHARPE RATIO</div>
          <div className="text-blue-400 text-2xl font-bold">{data.sharpe_ratio}</div>
          <div className="text-xs text-gray-500"> {'>'}1.0 = Institutional</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs">SORTINO RATIO</div>
          <div className="text-blue-400 text-2xl font-bold">{data.sortino_ratio}</div>
          <div className="text-xs text-gray-500">Downside risk adjusted</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs">PROFIT FACTOR</div>
          <div className="text-green-400 text-2xl font-bold">{data.profit_factor}</div>
          <div className="text-xs text-gray-500"> {'>'}1.5 = Good</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs">RECOVERY FACTOR</div>
          <div className="text-yellow-400 text-2xl font-bold">{data.recovery_factor}</div>
          <div className="text-xs text-gray-500">Net Profit / Max DD</div>
        </Card>
      </div>
      
      <Card>
        <div className="text-yellow-400 font-semibold text-sm mb-4">Equity & Drawdown Curve</div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data.equity_curve}>
            <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }} />
            <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </PageLayout>
  )
}