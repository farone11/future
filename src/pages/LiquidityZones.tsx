import { useEffect, useState } from 'react';
import PageLayout from '../components/PageLayout';
import Card from '../components/Card';
import { api } from '../services/api';

interface SessionData {
  high: number;
  low: number;
  mid: number;
  range: number;
}

interface LiquidityZone {
  type: string;
  price: number;
  status: string;
  age: string;
  ob: boolean;
}

interface DashboardData {
  sessions: {
    asia: SessionData;
    london: SessionData;
    newyork: SessionData;
  };
  liquidity_zones: LiquidityZone[];
}

// Sesuai Architecture Rules: Dashboard refresh 3000ms
const REFRESH_INTERVAL = 3000;

// Graceful fallback kalo API mati
const FALLBACK_DATA: DashboardData = {
  sessions: {
    asia: { high: 0, low: 0, mid: 0, range: 0 },
    london: { high: 0, low: 0, mid: 0, range: 0 },
    newyork: { high: 0, low: 0, mid: 0, range: 0 },
  },
  liquidity_zones: []
};

export default function LiquidityZones() {
  const [data, setData] = useState<DashboardData>(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState(api.getConnectionState());

  useEffect(() => {
    // Subscribe ke connection state: LIVE / STANDBY / ERROR
    const unsubscribe = api.onConnectionChange(setConnectionState);
    
    let mounted = true;

    const fetchData = async () => {
      try {
        // Pake centralized API service, bukan fetch langsung
        const json = await api.getDashboard();
        if (mounted) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError('API unavailable - running in fallback mode');
          console.error('Failed fetch liquidity:', err);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    
    return () => {
      mounted = false;
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const zones = data.liquidity_zones || [];
  const sessions = data.sessions;

  const bslCount = zones.filter(z => z.type === 'BSL' && z.status === 'ACTIVE').length;
  const sslCount = zones.filter(z => z.type === 'SSL' && z.status === 'ACTIVE').length;
  const sessionCount = Object.values(sessions).filter(s => s.range > 0).length;

  return (
    <PageLayout
      title="Liquidity Zones - XAUUSD H1"
      subtitle="Buy-Side & Sell-Side Liquidity + Session Levels · Auto Sweep Detection"
      connectionState={connectionState}
    >
      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">BUY-SIDE LIQUIDITY</div>
          <div className="text-red-400 text-4xl font-bold">{bslCount}</div>
          <div className="text-gray-500 text-xs mt-1">Above Highs · Sweep Target</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">SELL-SIDE LIQUIDITY</div>
          <div className="text-green-400 text-4xl font-bold">{sslCount}</div>
          <div className="text-gray-500 text-xs mt-1">Below Lows · Sweep Target</div>
        </Card>
        <Card>
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">SESSION LIQUIDITY</div>
          <div className="text-blue-400 text-4xl font-bold">{sessionCount}</div>
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
              {loading? (
                <tr><td colSpan={5} className="text-center py-4 text-gray-500">Loading...</td></tr>
              ) : zones.length === 0? (
                <tr><td colSpan={5} className="text-center py-4 text-gray-500">No liquidity zones</td></tr>
              ) : zones.map((zone, i) => (
                <tr key={i} className="border-b border-[#1e1e24] last:border-0 hover:bg-white/2 transition-colors">
                  <td className="py-2 pr-6">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                        zone.type === 'SSL'? 'bg-green-600' : 'bg-red-600'
                      }`}>
                      {zone.type}
                    </span>
                  </td>
                  <td className="py-2 pr-6 text-gray-200 font-mono">{zone.price.toFixed(2)}</td>
                  <td className="py-2 pr-6">
                    <span className={zone.status === 'ACTIVE'? 'text-green-400' : 'text-gray-500'}>
                      {zone.status}
                    </span>
                  </td>
                  <td className="py-2 pr-6 text-gray-400">{zone.age}</td>
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

      {/* Session levels */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: 'Asia Session', key: 'asia' as const },
          { name: 'London Session', key: 'london' as const },
          { name: 'New York Session', key: 'newyork' as const }
        ].map((session) => {
          const s = sessions[session.key];
          const hasData = s && s.range > 0;
          return (
            <Card key={session.name}>
              <div className="text-yellow-400 font-semibold text-sm mb-3">{session.name}</div>
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
              </div>
            </Card>
          );
        })}
      </div>
    </PageLayout>
  );
}
