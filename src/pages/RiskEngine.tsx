import PageLayout from '../components/PageLayout';
import Card from '../components/Card';

const riskMetrics = [
  { label: 'Daily Loss Limit', current: 0, max: 5 },
  { label: 'Weekly Drawdown', current: 0, max: 10 },
  { label: 'Max Exposure', current: 0, max: 15 },
];

export default function RiskEngine() {
  return (
    <PageLayout
      title="RISK ENGINE - INSTITUTIONAL GRADE"
      subtitle="Position Sizing · Drawdown Control · Kelly Criterion · Real-time Risk Metrics"
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-2">ACCOUNT RISK</div>
          <div className="text-red-400 text-3xl font-bold">0.0%</div>
          <div className="text-gray-500 text-xs mt-1">Max 2% per trade</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-2">DAILY DRAWDOWN</div>
          <div className="text-yellow-400 text-3xl font-bold">0.0%</div>
          <div className="text-gray-500 text-xs mt-1">Max 5% daily</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-2">KELLY OPTIMAL</div>
          <div className="text-green-400 text-3xl font-bold">0.0%</div>
          <div className="text-gray-500 text-xs mt-1">Position Size %</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-2">R:R RATIO</div>
          <div className="text-blue-400 text-3xl font-bold">0.0</div>
          <div className="text-gray-500 text-xs mt-1">Average</div>
        </Card>
      </div>

      {/* Risk Meter + Account Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-4">Risk Meter - Auto Refresh</div>
          <div className="space-y-5">
            {riskMetrics.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">{m.label}</span>
                  <span className="text-gray-500">{m.current}% / {m.max}%</span>
                </div>
                <div className="w-full bg-[#1e1e24] rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(m.current / m.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-4">Account Summary</div>
          <div className="space-y-3">
            {[
              { label: 'Balance:', value: '$0.00' },
              { label: 'Equity:', value: '$0.00' },
              { label: 'Daily P&L:', value: '$0.00' },
              { label: 'Open Positions:', value: '0' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm border-b border-[#1e1e24] pb-2 last:border-0 last:pb-0">
                <span className="text-gray-400">{row.label}</span>
                <span className="text-gray-200 font-semibold">{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Active Risk Positions */}
      <Card>
        <div className="text-yellow-400 font-semibold text-sm mb-4">Active Risk Positions</div>
        <div className="text-center py-8 text-gray-600 text-sm">No active positions</div>
      </Card>

      {/* Risk Calculator */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-3">Position Size Calculator</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Account Balance</span>
              <span className="text-gray-300">$0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Risk %</span>
              <span className="text-yellow-400">1.0%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Stop Loss (pips)</span>
              <span className="text-gray-300">---</span>
            </div>
            <div className="border-t border-[#1e1e24] pt-2 flex justify-between">
              <span className="text-gray-400 font-semibold">Lot Size</span>
              <span className="text-green-400 font-bold">0.00</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-3">Drawdown Tracker</div>
          <div className="space-y-2 text-xs">
            {['Daily', 'Weekly', 'Monthly'].map((period) => (
              <div key={period} className="flex justify-between">
                <span className="text-gray-500">{period} DD</span>
                <span className="text-green-400">0.00%</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-3">Win Rate Stats</div>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Total Trades', value: '0' },
              { label: 'Win Rate', value: '0%' },
              { label: 'Avg RR', value: '0.0' },
              { label: 'Profit Factor', value: '0.0' },
            ].map((stat) => (
              <div key={stat.label} className="flex justify-between">
                <span className="text-gray-500">{stat.label}</span>
                <span className="text-gray-300">{stat.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}
