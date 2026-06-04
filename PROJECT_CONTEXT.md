Context Project FARONE.AI:

STACK:
React + Vite + TS + Tailwind, Backend FastAPI uvicorn port 5400

PROGRESS SEKARANG:
1. Backend udah jalan di C:\Users\DELL\Documents\farone-ai-backend\main.py
   Endpoint: /api/dashboard dan /api/signals, CORS udah bener
2. Frontend udah jalan port 5173, path: C:\Users\DELL\Documents\New project\Project_02
3. Sidebar.tsx udah fetch API, ada menu routing react-router-dom, collapse, logo placeholder
4. App.tsx udah pake BrowserRouter, Routes ke 4 page: Dashboard, Signals, History, Settings
5. Folder src/pages/ udah ada: Dashboard.tsx, Signals.tsx, History.tsx, Settings.tsx, AISignals.tsx
6. Dashboard udah nampilin data live: ACTIVE, $4436.54, BUY, 87.5% dari API

DATA API DASHBOARD:
{
  "ai_status": "ACTIVE",
  "gold_price": 4436.54,
  "daily_change": 12.3,
  "active_signal": {"status": "BUY", "entry": 4435.5, "sl": 4420.0, "tp1": 4450.0},
  "risk_engine": {"lot_size": 0.05, "drawdown": 2.1, "status": "LOW RISK"},
  "win_rate": 87.5,
  "total_trades": 142
}

NEXT TASK:
1. Ganti logo N jadi logo.png naga di Sidebar
2. Isi page Signals.tsx ambil data dari /api/signals
3. Isi page History.tsx
4. Deploy ke Railway

LANJUT DARI SINI.