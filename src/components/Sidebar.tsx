import { useState } from 'react';
import { LayoutDashboard, TrendingUp, Droplets, Shield, Zap, Menu, X, Download } from 'lucide-react';

type Page = 'dashboard' | 'institutional-flow' | 'liquidity-zones' | 'risk-engine' | 'ai-signals';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { id: 'institutional-flow', label: 'Institutional Flow', icon: <TrendingUp size={16} /> },
  { id: 'liquidity-zones', label: 'Liquidity Zones', icon: <Droplets size={16} /> },
  { id: 'risk-engine', label: 'Risk Engine', icon: <Shield size={16} /> },
  { id: 'ai-signals', label: 'AI Signals', icon: <Zap size={16} /> },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-[#0d0d0f] border-r border-[#1e1e24] transition-all duration-300 ${
        collapsed ? 'w-14' : 'w-44'
      } min-h-screen shrink-0`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-[#1e1e24]">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black font-bold text-xs">
              FA
            </div>
            <div className="leading-tight">
              <div className="text-yellow-400 font-bold text-sm tracking-widest">FARONE</div>
              <div className="text-yellow-600 text-[10px] tracking-widest">GOLD AI</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black font-bold text-xs">
            FA
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Menu size={16} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-3 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X size={16} />
        </button>
      )}

      {/* Nav */}
      <nav className="flex flex-col gap-1 mt-4 px-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 px-2 py-2 rounded text-sm transition-all duration-150 text-left ${
              activePage === item.id
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Download button */}
      <div className="mt-auto px-2 pb-4">
        <a
          href="/farone-gold-ai.zip"
          download="farone-gold-ai.zip"
          title={collapsed ? 'Download Source' : undefined}
          className="flex items-center gap-3 px-2 py-2 rounded text-sm transition-all duration-150 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/5 border border-transparent hover:border-yellow-500/20 w-full"
        >
          <span className="shrink-0"><Download size={16} /></span>
          {!collapsed && <span className="truncate">Download ZIP</span>}
        </a>
      </div>
    </aside>
  );
}
