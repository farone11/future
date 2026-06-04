import { useEffect, useState } from 'react'

interface Trade {
  id: string
  pair: string
  type: 'BUY' | 'SELL'
  entry: number
  exit: number
  profit: number
  closed_at: string
  result: 'WIN' | 'LOSS'
}

export default function History() {
  const [trades, setTrades] = useState<Trade[]>([])
  
  useEffect(() => {
    // Ganti ke http://localhost:5400/api/history kalau udah ada
    // Untuk sementara pake dummy
    const dummyData: Trade[] = [
      { id: '1', pair: 'XAUUSD', type: 'BUY', entry: 4410.2, exit: 4450.0, profit: 199.0, closed_at: '2026-06-03', result: 'WIN' },
      { id: '2', pair: 'XAUUSD', type: 'SELL', entry: 4440.5, exit: 4420.0, profit: 102.5, closed_at: '2026-06-02', result: 'WIN' },
      { id: '3', pair: 'XAUUSD', type: 'BUY', entry: 4425.0, exit: 4420.0, profit: -25.0, closed_at: '2026-06-01', result: 'LOSS' },
    ]
    setTrades(dummyData)
  }, [])

  const totalProfit = trades.reduce((sum, trade) => sum + trade.profit, 0)
  const wins = trades.filter(t => t.result === 'WIN').length
  const winRate = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : 0

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Trade History</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Total P/L</p>
          <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${totalProfit.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Win Rate</p>
          <p className="text-2xl font-bold text-blue-400">{winRate}%</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Total Trades</p>
          <p className="text-2xl font-bold">{trades.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full bg-gray-800 rounded-lg">
          <thead className="bg-gray-700">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Pair</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Entry</th>
              <th className="p-3 text-left">Exit</th>
              <th className="p-3 text-left">Profit</th>
              <th className="p-3 text-left">Result</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => (
              <tr key={trade.id} className="border-t border-gray-700">
                <td className="p-3">{trade.closed_at}</td>
                <td className="p-3">{trade.pair}</td>
                <td className="p-3">{trade.type}</td>
                <td className="p-3">${trade.entry}</td>
                <td className="p-3">${trade.exit}</td>
                <td className={`p-3 font-bold ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${trade.profit.toFixed(2)}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    trade.result === 'WIN' ? 'bg-green-600' : 'bg-red-600'
                  }`}>
                    {trade.result}
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