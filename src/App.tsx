import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import InstitutionalFlow from './pages/InstitutionalFlow';
import LiquidityZones from './pages/LiquidityZones';
import RiskEngine from './pages/RiskEngine';
import AISignals from './pages/AISignals';

type Page = 'dashboard' | 'institutional-flow' | 'liquidity-zones' | 'risk-engine' | 'ai-signals';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'institutional-flow': return <InstitutionalFlow />;
      case 'liquidity-zones': return <LiquidityZones />;
      case 'risk-engine': return <RiskEngine />;
      case 'ai-signals': return <AISignals />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0c]">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="flex-1 overflow-y-auto">
        {renderPage()}
      </main>
    </div>
  );
}
