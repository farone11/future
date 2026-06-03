import { useEffect, useState } from 'react';
import PageLayout from '../components/PageLayout';
import Card from '../components/Card';

const AI_PANEL = [
  { model: 'SMC Engine', status: 'Standby', color: 'text-yellow-400' },
  { model: 'PRZ Scanner', status: 'Scanning', color: 'text-blue-400' },
  { model: 'Liquidity Sweep', status: 'Monitoring', color: 'text-cyan-400' },
  { model: 'Risk AI', status: 'Protected', color: 'text-green-400' },
];

export default function Dashboard() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = time.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });

  return (
    <PageLayout
      title="FUTURISTIC GOLD TRADING ANALYTICS"
      subtitle="Institutional Intelligence Layer · XAUUSD Analytics · Professional Environment"
      badge={`Live MT5 | Bias: BEARISH | ${timeStr}`}
      badgeColor="text-green-400"
    >
      {/* Disclaimer */}
      <div className="mb-4 px-3 py-2 border border-yellow-500/30 bg-yellow-500/5 rounded text-yellow-200/70 text-xs">
        <span className="text-yellow-400 font-semibold">DISCLAIMER:</span> This dashboard is for informational and educational purposes only. Trading forex, CFDs, and gold involves substantial risk of loss and is not suitable for every investor. Past performance is not indicative of future results. AI signals are not financial advice.
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        <Card className="col-span-1">
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">XAUUSD PRICE</div>
          <div className="text-yellow-400 text-2xl font-bold">$4436.54</div>
          <div className="text-gray-500 text-xs mt-1">Live Update</div>
        </Card>
        <Card className="col-span-1">
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">SMART MONEY BIAS</div>
          <div className="text-red-400 text-2xl font-bold">BEARISH</div>
          <div className="text-gray-500 text-xs mt-1">SMI: —</div>
        </Card>
        <Card className="col-span-1">
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">CFTC NET</div>
          <div className="text-green-400 text-2xl font-bold">245,678</div>
          <div className="text-gray-500 text-xs mt-1">As of 01/06/26</div>
        </Card>
        <Card className="col-span-1">
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">SEASONAL BIAS</div>
          <div className="text-yellow-400 text-2xl font-bold">BULLISH</div>
          <div className="text-gray-500 text-xs mt-1">June: 1.3 avg</div>
        </Card>
        <Card className="col-span-1">
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">DAILY RISK</div>
          <div className="text-cyan-400 text-2xl font-bold">1.2%</div>
          <div className="text-gray-500 text-xs mt-1">Inst. Allocation</div>
        </Card>
        <Card className="col-span-1">
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">CME MAX PAIN</div>
          <div className="text-blue-400 text-2xl font-bold">$4525</div>
          <div className="text-gray-500 text-xs mt-1">MarketBulls</div>
        </Card>
        <Card className="col-span-1">
          <div className="flex items-center justify-between mb-1">
            <div className="text-gray-400 text-[10px] uppercase tracking-widest">RETAIL SENTIMENT</div>
            <span className="text-[10px] text-green-400 border border-green-400/50 px-1 rounded">Live</span>
          </div>
          <div className="text-green-400 text-xl font-bold">72% Long</div>
          <div className="text-red-400 text-xl font-bold">28% Short</div>
          <div className="text-gray-500 text-xs mt-1">{timeStr}</div>
        </Card>
      </div>

      {/* Chart + AI Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-yellow-400 font-semibold text-sm">Institutional Momentum Engine - Live XAUUSD H1</div>
            <button className="text-xs text-gray-400 border border-gray-600 px-2 py-1 rounded hover:border-gray-400 transition-colors">
              Expand 50/50
            </button>
          </div>
          <div className="w-full" style={{ height: 340 }}>
            <iframe
              src="https://www.tradingview.com/widgetembed/?frameElementId=tradingview&symbol=OANDA%3AXAUUSD&interval=60&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=1&saveimage=1&toolbarbg=1e1e24&studies=[]&theme=dark&style=1&timezone=exchange&withdateranges=1&showpopupbutton=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en"
              className="w-full h-full rounded border border-[#1e1e24]"
              allowTransparency
              scrolling="no"
              allowFullScreen
            />
          </div>
        </Card>

        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-4">AI Execution Panel</div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-3 border-b border-[#1e1e24] pb-2">
            <span>Model</span>
            <span>Status</span>
          </div>
          <div className="flex flex-col gap-3">
            {AI_PANEL.map((item) => (
              <div key={item.model} className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{item.model}</span>
                <span className={`text-sm font-semibold ${item.color}`}>{item.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-[#1e1e24] text-xs text-gray-500 space-y-1">
            <div>Last Update: {timeStr}</div>
            <div>COT: {dateStr}</div>
            <div>Retail Lots:</div>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}
