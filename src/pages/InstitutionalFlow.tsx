import PageLayout from '../components/PageLayout';
import Card from '../components/Card';

export default function InstitutionalFlow() {
  return (
    <PageLayout
      title="Institutional Flow Analysis"
      subtitle="Live from MT5 + Tailscale"
      badge="Live from MT5 + Tailscale"
      badgeColor="text-green-400"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CFTC COT Report */}
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-1">CFTC COT Report</div>
          <div className="text-gray-500 text-xs mb-4">As of --/--/--</div>
          <div className="text-center mb-4">
            <div className="text-yellow-400 text-3xl font-bold tracking-widest">---,---</div>
            <div className="text-gray-400 text-xs mt-1">Net Non-Commercial</div>
          </div>
          <div className="flex justify-between text-xs mt-2 pt-3 border-t border-[#1e1e24]">
            <span className="text-green-400">Long: ---,---</span>
            <span className="text-red-400">Short: ---,---</span>
          </div>
        </Card>

        {/* Retail Sentiment SWFX */}
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-1">Retail Sentiment SWFX</div>
          <div className="text-gray-500 text-xs mb-4">Live MT5</div>
          <div className="flex justify-around items-center py-3">
            <div className="text-center">
              <div className="text-green-400 text-3xl font-bold">--%</div>
              <div className="text-gray-400 text-xs mt-1">Long</div>
            </div>
            <div className="w-px h-10 bg-[#1e1e24]" />
            <div className="text-center">
              <div className="text-red-400 text-3xl font-bold">--%</div>
              <div className="text-gray-400 text-xs mt-1">Short</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#1e1e24]">
            <div className="w-full bg-[#1e1e24] rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '50%' }} />
            </div>
          </div>
        </Card>

        {/* Smart Money Index */}
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-1">Smart Money Index</div>
          <div className="text-gray-500 text-xs mb-4">&nbsp;</div>
          <div className="text-center py-3">
            <div className="text-yellow-400 text-3xl font-bold">undefined</div>
            <div className="text-gray-500 text-sm mt-2">undefined</div>
            <div className="text-gray-600 text-xs mt-2">Updated: undefined</div>
          </div>
        </Card>
      </div>

      {/* COT Historical Breakdown */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-3">COT Positioning History</div>
          <div className="space-y-3">
            {['Week -1', 'Week -2', 'Week -3', 'Week -4'].map((week, i) => (
              <div key={week} className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-14 shrink-0">{week}</span>
                <div className="flex-1 bg-[#1e1e24] rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-yellow-600 to-yellow-400 h-2 rounded-full"
                    style={{ width: `${65 - i * 8}%` }}
                  />
                </div>
                <span className="text-gray-400 text-xs w-10 text-right">{65 - i * 8}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-3">Flow Summary</div>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Institutional Net Position', value: '---', color: 'text-gray-300' },
              { label: 'Managed Money Long', value: '---,---', color: 'text-green-400' },
              { label: 'Managed Money Short', value: '---,---', color: 'text-red-400' },
              { label: 'Commercial Hedgers', value: '---,---', color: 'text-blue-400' },
              { label: 'Non-Reportable', value: '---,---', color: 'text-gray-400' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center border-b border-[#1e1e24] pb-2 last:border-0 last:pb-0">
                <span className="text-gray-400 text-xs">{row.label}</span>
                <span className={`font-semibold text-xs ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}
