import { useState } from 'react'
import { useSignalWS } from '../hooks/useSignalWS'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import { TrendingUp, TrendingDown, Wifi, WifiOff } from 'lucide-react'

export default function Signals() {
  const { signals, connected, lastUpdate } = useSignalWS()
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL')

  const filteredSignals = signals.filter(s => {
    if (filter === 'ACTIVE') return ['WAITING', 'ACTIVE', 'TRIGGERED'].includes(s.status)
    if (filter === 'CLOSED') return ['CLOSED', 'SL_HIT', 'TP_HIT', 'TP1_HIT', 'TP2_HIT'].includes(s.status)
    return true
  })

  const activeCount = signals.filter(s => ['WAITING', 'ACTIVE', 'TRIGGERED'].includes(s.status)).length

  return (
    <PageLayout
      title="AI TRADING SIGNALS"
      subtitle="Real-time signals from Institutional AI Models · XAUUSD Focus · Audit Trail Enabled"
      badge={`Total: ${signals.length} | Active: ${activeCount}`}
    >
      <div className={`mb-4 flex items-center justify-between px-3 py-2 border rounded text-xs
        ${connected 
        ? 'border-green-500/30 bg-green-500/5 text-green-200/70' 
         : 'border-red-500/30 bg-red-500/5 text-red-200/70'
        }`}>
        <div className="flex items-center gap-2">
          {connected? <Wifi size={14} className="text-green-400" /> : <WifiOff size={14} className="text-red-400" />}
          <span className={connected? 'text-green-400' : 'text-red-400'}>
            {connected? 'LIVE' : 'DISCONNECTED'}
          </span>
        </div>
        <span className="text-gray-400">Last update: {lastUpdate}</span>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-yellow-400 font-semibold text-sm">Signal Audit Log</div>
          <div className="flex gap-2">
            {(['ALL', 'ACTIVE', 'CLOSED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded border transition-colors
                  ${filter === f 
                  ? 'bg-yellow-600/20 text-yellow-400 border-yellow-400/50' 
                   : 'text-gray-400 border-gray-600 hover:border-gray-500'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filteredSignals.length === 0? (
          <div className="text-gray-500 text-sm text-center py-8">
            {connected? 'No signals yet. AI is scanning the market...' : 'Connecting to signal server...'}
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredSignals.map((s) => (
              <div key={s.id} className="p-3 rounded border border-[#1e1e24] bg-[#0a0a0b] hover:border-[#2a2a30] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {s.type === 'BUY'? 
                      <TrendingUp size={16} className="text-green-400" /> : 
                      <TrendingDown size={16} className="text-red-400" />
                    }
                    <span className={`font-bold ${s.type === 'BUY'? 'text-green-400' : 'text-red-400'}`}>
                      {s.type}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                      {s.source || 'AI'}
                    </span>
                    {s.confidence && (
                      <span className="text-xs px-2 py-0.5 bg-blue-600/20 rounded text-blue-400">
                        {s.confidence}%
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{s.time || '-'}</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                  <div>
                    <div className="text-gray-400 text-xs">Entry</div>
                    <div className="text-white font-bold">${s.entry?.toFixed(2) || '0.00'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">SL</div>
                    <div className="text-red-400 font-bold">${s.sl?.toFixed(2) || '0.00'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">TP1</div>
                    <div className="text-green-400 font-bold">${(s.tp1 || s.tp)?.toFixed(2) || '0.00'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">TP2</div>
                    <div className="text-green-400 font-bold">${s.tp2?.toFixed(2) || '0.00'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">R:R</div>
                    <div className="text-white font-bold">1:{s.rr?.toFixed(1) || '0.0'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Status</div>
                    <div className={`font-bold text-xs ${
                      s.status === 'ACTIVE'? 'text-green-400' : 
                      s.status === 'WAITING'? 'text-yellow-400' : 
                      'text-gray-400'
                    }`}>
                      {s.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      
      <div className="mt-4 px-3 py-2 border border-yellow-500/30 bg-yellow-500/5 rounded text-yellow-200/70 text-xs">
        <span className="text-yellow-400 font-semibold">DISCLAIMER:</span> Signals are generated by AI models and are not financial advice. Past performance does not guarantee future results. Trade at your own risk.
      </div>
    </PageLayout>
  )
}