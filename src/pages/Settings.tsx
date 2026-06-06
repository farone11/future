import { useEffect, useState } from 'react';
import PageLayout from '../components/PageLayout';
import Card from '../components/Card';
import toast from 'react-hot-toast';
import { Save, Shield, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.faronecapital.online';

interface Settings {
  risk_per_trade: number;
  max_daily_dd: number;
  max_lot: number;
  kill_switch: boolean;
  trading_hours: { start: string; end: string };
  ai_modules: { smc: boolean; prz: boolean; liquidity: boolean; risk_ai: boolean };
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setSettings(data);
      } catch (err) {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings. Check backend.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof Settings, value: any) => {
    setSettings(prev => prev? {...prev, [key]: value } : null);
  };

  const updateNested = (parent: keyof Settings, key: string, value: any) => {
    setSettings(prev => {
      if (!prev) return null;
      return {
       ...prev,
        [parent]: {...prev[parent], [key]: value }
      };
    });
  };

  if (loading) return <div className="p-8 text-gray-400">Loading settings...</div>;
  if (!settings) return <div className="p-8 text-red-400">Failed to load settings</div>;

  return (
    <PageLayout
      title="RISK & AI SETTINGS"
      subtitle="Institutional Risk Controls · Real-time Configuration"
      badge="Audit Mode"
      badgeColor="text-yellow-400"
    >
      {/* Kill Switch Alert */}
      <div className="mb-4 px-3 py-2 border border-red-500/30 bg-red-500/5 rounded text-red-200/70 text-xs">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <span className="text-red-400 font-semibold">WARNING:</span>
          <span>Changes apply immediately to live trading. Double-check before saving.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Management */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-red-400" />
            <h2 className="text-yellow-400 font-semibold text-sm">Risk Management</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-widest mb-1 block">
                Max Lot Size
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="10"
                value={settings.max_lot}
                onChange={(e) => updateField('max_lot', parseFloat(e.target.value))}
                className="w-full bg-[#1e1e24] border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-yellow-400 outline-none"
              />
              <div className="text-xs text-gray-500 mt-1">Max lot per trade. Range: 0.01 - 10.0</div>
            </div>

            <div>
              <label className="text-gray-400 text-xs uppercase tracking-widest mb-1 block">
                Max Daily Drawdown %
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="20"
                value={settings.max_daily_dd}
                onChange={(e) => updateField('max_daily_dd', parseFloat(e.target.value))}
                className="w-full bg-[#1e1e24] border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-yellow-400 outline-none"
              />
              <div className="text-xs text-gray-500 mt-1">Kill switch triggers at this DD. Range: 0.1% - 20%</div>
            </div>

            <div>
              <label className="text-gray-400 text-xs uppercase tracking-widest mb-1 block">
                Risk Per Trade %
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={settings.risk_per_trade}
                onChange={(e) => updateField('risk_per_trade', parseFloat(e.target.value))}
                className="w-full bg-[#1e1e24] border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-yellow-400 outline-none"
              />
              <div className="text-xs text-gray-500 mt-1">% of equity risked per trade. Range: 0.1% - 10%</div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1e1e24]">
              <div>
                <div className="text-gray-300 text-sm font-semibold">Kill Switch</div>
                <div className="text-xs text-gray-500">Auto-stop trading on max DD</div>
              </div>
              <button
                onClick={() => updateField('kill_switch',!settings.kill_switch)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.kill_switch? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.kill_switch? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </Card>

        {/* AI Modules */}
        <Card>
          <div className="text-yellow-400 font-semibold text-sm mb-4">AI Module Controls</div>

          <div className="space-y-4">
            {Object.entries(settings.ai_modules).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <div className="text-gray-300 text-sm font-semibold uppercase">{key} Engine</div>
                  <div className="text-xs text-gray-500">
                    {key === 'smc' && 'Smart Money Concept detection'}
                    {key === 'prz' && 'Potential Reversal Zone scanner'}
                    {key === 'liquidity' && 'Liquidity sweep monitoring'}
                    {key === 'risk_ai' && 'AI risk protection layer'}
                  </div>
                </div>
                <button
                  onClick={() => updateNested('ai_modules', key,!value)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    value? 'bg-green-600' : 'bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    value? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-[#1e1e24]">
            <div className="text-gray-400 text-xs uppercase tracking-widest mb-2">Trading Hours GMT+7</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Start</label>
                <input
                  type="time"
                  value={settings.trading_hours.start}
                  onChange={(e) => updateNested('trading_hours', 'start', e.target.value)}
                  className="w-full bg-[#1e1e24] border border-gray-600 rounded px-2 py-1 text-white text-sm focus:border-yellow-400 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">End</label>
                <input
                  type="time"
                  value={settings.trading_hours.end}
                  onChange={(e) => updateNested('trading_hours', 'end', e.target.value)}
                  className="w-full bg-[#1e1e24] border border-gray-600 rounded px-2 py-1 text-white text-sm focus:border-yellow-400 outline-none"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-yellow-500/20 border border-yellow-500 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          {saving? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="mt-4 px-3 py-2 border border-gray-600/30 bg-gray-600/5 rounded text-gray-400 text-xs">
        <span className="text-gray-300 font-semibold">Audit Log:</span> All changes are logged to `logs/farone_YYYY-MM-DD.log` for compliance.
      </div>
    </PageLayout>
  );
}
