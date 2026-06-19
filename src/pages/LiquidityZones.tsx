import { useLiquidityWS } from '../hooks/useLiquidityWS'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'

function formatAge(timestamp?: number): string {
  if (!timestamp) return "0m"
  const now = Math.floor(Date.now() / 1000)
  const diffSec = now - timestamp
  if (diffSec < 60) return "<1m"
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay > 0) {
    const hours = diffHour % 24
    return hours > 0? `${diffDay}d ${hours}h` : `${diffDay}d`
  }
  if (diffHour > 0) {
    const mins = diffMin % 60
    return mins > 0? `${diffHour}h ${mins}m` : `${diffHour}h`
  }
  return `${diffMin}m`
}

export default function LiquidityZones() {
  const { data, loading, error } = useLiquidityWS()

  const zones = (data?.liquidity_zones || [])
  .filter(z => z.status === 'ACTIVE')
  .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  const sessions = data?.sessions

  const bslCount = zones.filter(z => z.type === 'BSL').length
  const sslCount = zones.filter(z => z.type === 'SSL').length
  const sessionCount = sessions? Object.values(sessions).filter(s => s.range > 0).length : 0

  return (
    <PageLayout
      title="Liquidity Zones - XAUUSD H1"
      subtitle="Buy-Side & Sell-Side Liquidity + Session Levels · Auto Sweep Detection"
    >
      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">BUY-SIDE LIQUIDITY</div>
          <div className="text-red-400 text-4xl font-bold">{bslCount}</div>
          <div className="text-gray-500 text-xs mt-1">Above Highs · Sweep Target</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">SELL-SIDE LIQUIDITY</div>
          <div className="text-green-400 text-4xl font-bold">{sslCount}</div>
          <div className="text-gray-500 text-xs mt-1">Below Lows · Sweep Target</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">SESSION LIQUIDITY</div>
          <div className="text-blue-400 text-4xl font-bold">{sessionCount}</div>
          <div className="text-gray-500 text-xs mt-1">Asia / London / NY</div>
        </Card>
      </div>

      <Card>
        <div className="text-yellow-400 font-semibold text-sm mb-4">Active Liquidity Zones</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e24] text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left pb-2 pr-6">Type</th>
                <th className="text-left pb-2 pr-6">Price Zone</th>
                <th className="text-left pb-2 pr-6">Status</th>
                <th className="text-left pb-2 pr-6">Age</th>
                <th className="text-left pb-2">OB Confluence</th>
              </tr>
            </thead>
            <tbody>
              {loading? (
                <tr><td colSpan={5} className="text-center py-4 text-gray-500">Loading...</td></tr>
              ) : zones.length === 0? (
                <tr><td colSpan={5} className="text-center py-4 text-gray-500">No liquidity zones</td></tr>
              ) : zones.map((zone, i) => (
                <tr key={`${zone.type}-${zone.price}-${i}`} className="border-b border-[#1e1e24] last:border-0 hover:bg-white/2 transition-colors">
                  <td className="py-2 pr-6">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${
                        zone.type === 'SSL'? 'bg-green-600' : 'bg-red-600'
                      }`}>
                      {zone.type}
                    </span>
                  </td>
                  <td className="py-2 pr-6 text-gray-200 font-mono">
                    {zone.price.toFixed(2)}
                    {zone.session && <span className="text-gray-500 text-xs ml-2 capitalize">({zone.session})</span>}
                  </td>
                  <td className="py-2 pr-6">
                    <span className={zone.status === 'ACTIVE'? 'text-green-400' : 'text-gray-500'}>
                      {zone.status}
                    </span>
                  </td>
                  <td className="py-2 pr-6 text-gray-400">{formatAge(zone.timestamp)}</td>
                  <td className="py-2">
                    {zone.ob? (
                      <span className="text-green-400 font-semibold">YES</span>
                    ) : (
                      <span className="text-gray-600">NO</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: 'Asia Session', key: 'asia' as const, time: '05:00 - 13:00 WIB' },
          { name: 'London Session', key: 'london' as const, time: '13:00 - 22:00 WIB' },
          { name: 'New York Session', key: 'newyork' as const, time: '19:00 - 04:00 WIB' }
        ].map((session) => {
          const s = sessions?.[session.key]
          const hasData = s && s.range > 0
          return (
            <Card key={session.name}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-yellow-400 font-semibold text-sm">{session.name}</div>
                <div className="text-gray-500 text-xs">{session.time}</div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">High</span>
                  <span className="text-gray-300 font-mono">{hasData? s.high.toFixed(2) : '----.--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Low</span>
                  <span className="text-gray-300 font-mono">{hasData? s.low.toFixed(2) : '----.--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mid</span>
                  <span className="text-gray-300 font-mono">{hasData? s.mid.toFixed(2) : '----.--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Range</span>
                  <span className="text-yellow-400 font-mono">{hasData? `${s.range} pips` : '--- pips'}</span>
                </div>
                {hasData && (
                  <div className="pt-2 mt-2 border-t border-[#1e1e24] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-red-400">SELL Zone</span>
                      <span className="text-red-400 font-mono">{s.high.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-400">BUY Zone</span>
                      <span className="text-green-400 font-mono">{s.low.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </PageLayout>
  )
}