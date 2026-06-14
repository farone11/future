import PageLayout from '../components/PageLayout';
import Card from '../components/Card';

export default function AISignals() {
  return (
    <PageLayout
      title="AI SIGNAL CENTER"
      subtitle="Live trade signals from 5-layer confluence engine: Maxwell AI + OB + Liquidity + COT + Seasonal"
    >
      {/* Current Signal */}
      <Card className="mb-4">
        <div className="text-yellow-400 font-semibold text-sm mb-4">Current Signal</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-2">STATUS</div>
            <div className="text-yellow-400 text-2xl font-bold tracking-widest">STANDBY</div>
          </div>
          <div>
            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-2">ENTRY</div>
            <div className="text-white text-2xl font-bold tracking-widest font-mono">-----.--</div>
          </div>
          <div>
            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-2">STOP LOSS</div>
            <div className="text-red-400 text-2xl font-bold tracking-widest font-mono">-----.--</div>
          </div>
          <div>
            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-2">TAKE PROFIT 1</div>
            <div className="text-green-400 text-2xl font-bold tracking-widest font-mono">-----.--</div>
          </div>
          <div>
            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-2">TAKE PROFIT 2</div>
            <div className="text-green-400 text-2xl font-bold tracking-widest font-mono">-----.--</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[#1e1e24] text-center">
          <div className="text-gray-500 text-sm">No confluence</div>
          <div className="text-gray-600 text-xs mt-1">Last Update: --:--:-- | Risk: 1% per trade</div>
        </div>
      </Card>

      {/* Confluence Engine */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-4">5-Layer Confluence Engine</div>
          <div className="space-y-3">
            {[
              { name: 'Maxwell AI', status: 'Waiting', color: 'text-yellow-400' },
              { name: 'Order Block (OB)', status: 'Scanning', color: 'text-blue-400' },
              { name: 'Liquidity Detection', status: 'Monitoring', color: 'text-cyan-400' },
              { name: 'COT Analysis', status: 'Loaded', color: 'text-green-400' },
              { name: 'Seasonal Patterns', status: 'Loaded', color: 'text-green-400' },
            ].map((layer) => (
              <div key={layer.name} className="flex items-center justify-between border-b border-[#1e1e24] pb-2 last:border-0 last:pb-0">
                <span className="text-gray-300 text-sm">{layer.name}</span>
                <span className={`text-xs font-semibold ${layer.color}`}>{layer.status}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-4">Signal History</div>
          <div className="text-center py-6 text-gray-600 text-sm">No signal history available</div>
        </Card>
      </div>

      {/* Signal Rules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-3">Entry Criteria</div>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">▸</span>
              <span>Minimum 3/5 confluence layers active</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">▸</span>
              <span>OB + Liquidity confluence required</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">▸</span>
              <span>COT alignment with trade direction</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">▸</span>
              <span>Session timing: London / NY overlap</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-3">Risk Parameters</div>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Risk Per Trade', value: '1%' },
              { label: 'Min R:R', value: '1:2' },
              { label: 'Max Trades/Day', value: '3' },
              { label: 'Max Open Positions', value: '2' },
            ].map((param) => (
              <div key={param.label} className="flex justify-between">
                <span className="text-gray-500">{param.label}</span>
                <span className="text-gray-200 font-semibold">{param.value}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-3">Performance Stats</div>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Total Signals', value: '0' },
              { label: 'Win Rate', value: '0%' },
              { label: 'Avg R:R Achieved', value: '0.0' },
              { label: 'Last Signal', value: 'None' },
            ].map((stat) => (
              <div key={stat.label} className="flex justify-between">
                <span className="text-gray-500">{stat.label}</span>
                <span className="text-gray-200 font-semibold">{stat.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}