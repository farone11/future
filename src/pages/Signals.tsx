import { useEffect, useState } from 'react'

interface Signal {
  id: string
  pair: string
  type: 'BUY' | 'SELL'
  entry: number
  sl: number
  tp1: number
  tp2?: number
  status: 'ACTIVE' | 'CLOSED' | 'CANCELLED'
  timestamp: string
  confidence: number
}

export default function Signals() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://localhost:5400/api/signals')
      .then(res => res.json())
      .then(data => {
        setSignals(data.signals || data) // sesuaikan sama struktur API kamu
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching signals:', err)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-6">Loading signals...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">AI Trading Signals</h1>
      
      <div className="overflow-x-auto">
        <table className="w-full bg-gray-800 rounded-lg">
          <thead className="bg-gray-700">
            <tr>
              <th className="p-3 text-left">Pair</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Entry</th>
              <th className="p-3 text-left">SL</th>
              <th className="p-3 text-left">TP</th>
              <th className="p-3 text-left">Confidence</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {signals.map(signal => (
              <tr key={signal.id} className="border-t border-gray-700">
                <td className="p-3 font-medium">{signal.pair}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    signal.type === 'BUY' ? 'bg-green-600' : 'bg-red-600'
                  }`}>
                    {signal.type}
                  </span>
                </td>
                <td className="p-3">${signal.entry}</td>
                <td className="p-3 text-red-400">${signal.sl}</td>
                <td className="p-3 text-green-400">${signal.tp1}</td>
                <td className="p-3">{signal.confidence}%</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    signal.status === 'ACTIVE' ? 'bg-blue-600' : 'bg-gray-600'
                  }`}>
                    {signal.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}