import PageLayout from '../components/PageLayout';
import Card from '../components/Card';

const zones = [
  { type: 'SSL', price: '4438.88', status: 'ACTIVE', age: '16h', ob: true },
  { type: 'SSL', price: '4433.59', status: 'ACTIVE', age: '9h', ob: true },
  { type: 'SSL', price: '4426.14', status: 'ACTIVE', age: '12h', ob: true },
  { type: 'SSL', price: '4452.35', status: 'AGED', age: '26h', ob: false },
  { type: 'SSL', price: '4452.68', status: 'AGED', age: '48h', ob: false },
  { type: 'BSL', price: '4458.03', status: 'ACTIVE', age: '14h', ob: false },
  { type: 'SSL', price: '4478.52', status: 'AGED', age: '31h', ob: false },
  { type: 'BSL', price: '4488.24', status: 'ACTIVE', age: '21h', ob: false },
];

export default function LiquidityZones() {
  return (
    <PageLayout
      title="Liquidity Zones - XAUUSD H1"
      subtitle="Buy-Side & Sell-Side Liquidity + Session Levels · Auto Sweep Detection"
    >
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">BUY-SIDE LIQUIDITY</div>
          <div className="text-red-400 text-4xl font-bold">2</div>
          <div className="text-gray-500 text-xs mt-1">Above Highs · Sweep Target</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">SELL-SIDE LIQUIDITY</div>
          <div className="text-green-400 text-4xl font-bold">6</div>
          <div className="text-gray-500 text-xs mt-1">Below Lows · Sweep Target</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">SESSION LIQUIDITY</div>
          <div className="text-blue-400 text-4xl font-bold">0</div>
          <div className="text-gray-500 text-xs mt-1">Asia / London / NY</div>
        </Card>
      </div>

      {/* Table */}
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
              {zones.map((zone, i) => (
                <tr
                  key={i}
                  className="border-b border-[#1e1e24] last:border-0 hover:bg-white/2 transition-colors"
                >
                  <td className="py-2 pr-6">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                        zone.type === 'SSL' ? 'bg-green-600' : 'bg-red-600'
                      }`}
                    >
                      {zone.type}
                    </span>
                  </td>
                  <td className="py-2 pr-6 text-gray-200 font-mono">{zone.price}</td>
                  <td className="py-2 pr-6">
                    <span className={zone.status === 'ACTIVE' ? 'text-green-400' : 'text-gray-500'}>
                      {zone.status}
                    </span>
                  </td>
                  <td className="py-2 pr-6 text-gray-400">{zone.age}</td>
                  <td className="py-2">
                    {zone.ob ? (
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

      {/* Session levels */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {['Asia Session', 'London Session', 'New York Session'].map((session) => (
          <Card key={session}>
            <div className="text-yellow-400 font-semibold text-sm mb-3">{session}</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">High</span>
                <span className="text-gray-300 font-mono">----.--</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Low</span>
                <span className="text-gray-300 font-mono">----.--</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mid</span>
                <span className="text-gray-300 font-mono">----.--</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Range</span>
                <span className="text-yellow-400 font-mono">--- pips</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageLayout>
  );
}
