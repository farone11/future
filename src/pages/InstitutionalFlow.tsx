import { useState, useEffect } from "react";
 
// ─── Types ────────────────────────────────────────────────────────────────────
interface COTData {
  date: string;
  netNonCommercial: number;
  long: number;
  short: number;
  history: { week: string; pct: number }[];
  managedMoneyLong: number;
  managedMoneyShort: number;
  commercialHedgers: number;
  nonReportable: number;
}
 
interface RetailSentiment {
  longPct: number;
  shortPct: number;
}
 
interface SmartMoneyIndex {
  value: number;
  label: string;
  updatedAt: string;
}
 
// ─── Mock / static data (replace with live WebSocket / MT5 feed) ───────────────
const MOCK_COT: COTData = {
  date: "11/06/26",
  netNonCommercial: 245678,
  long: 200704,
  short: 46444,
  history: [
    { week: "Week -1", pct: 65 },
    { week: "Week -2", pct: 57 },
    { week: "Week -3", pct: 49 },
    { week: "Week -4", pct: 41 },
  ],
  managedMoneyLong: 180234,
  managedMoneyShort: 32100,
  commercialHedgers: -198450,
  nonReportable: 12890,
};
 
const MOCK_SENTIMENT: RetailSentiment = { longPct: 57, shortPct: 43 };
 
const MOCK_SMI: SmartMoneyIndex = {
  value: 70,
  label: "BULLISH",
  updatedAt: "2026-06-11 09:51:52",
};
 
// ─── Helper formatters ─────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 3 });
 
const signed = (n: number) => (n >= 0 ? `${fmt(n)}` : `-${fmt(n)}`);
 
// ─── Sub-components ────────────────────────────────────────────────────────────
 
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-[#1a1d2e] border border-[#2a2d40] p-6 ${className}`}
    >
      {children}
    </div>
  );
}
 
function CardTitle({
  children,
  color = "text-yellow-400",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return <h3 className={`text-sm font-semibold tracking-wide ${color}`}>{children}</h3>;
}
 
function CardSubtitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500 mt-0.5 mb-4">{children}</p>;
}
 
// Card 1 – CFTC COT Report
function COTReportCard({ data }: { data: COTData }) {
  return (
    <Card>
      <CardTitle>CFTC COT Report</CardTitle>
      <CardSubtitle>As of {data.date}</CardSubtitle>
 
      <div className="text-5xl font-bold text-yellow-400 tracking-tight">
        {data.netNonCommercial.toLocaleString("en-US", { minimumFractionDigits: 3 })}
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-4">Net Non-Commercial</p>
 
      <div className="flex justify-between text-sm">
        <span>
          Long:{" "}
          <span className="text-green-400 font-semibold">
            {data.long.toLocaleString("en-US", { minimumFractionDigits: 3 })}
          </span>
        </span>
        <span>
          Short:{" "}
          <span className="text-red-400 font-semibold">
            {data.short.toLocaleString("en-US", { minimumFractionDigits: 3 })}
          </span>
        </span>
      </div>
    </Card>
  );
}
 
// Card 2 – Retail Sentiment SWFX
function RetailSentimentCard({ data }: { data: RetailSentiment }) {
  return (
    <Card>
      <CardTitle color="text-yellow-400">Retail Sentiment SWFX</CardTitle>
      <CardSubtitle>Live MT5</CardSubtitle>
 
      <div className="flex items-center gap-8 mt-2">
        <div>
          <span className="text-5xl font-bold text-green-400">{data.longPct}%</span>
          <p className="text-xs text-gray-500 mt-1">Long</p>
        </div>
        <div>
          <span className="text-5xl font-bold text-red-400">{data.shortPct}%</span>
          <p className="text-xs text-gray-500 mt-1">Short</p>
        </div>
      </div>
 
      {/* Sentiment bar */}
      <div className="mt-5 h-2 rounded-full bg-[#2a2d40] overflow-hidden">
        <div
          className="h-full rounded-full bg-green-400 transition-all duration-700"
          style={{ width: `${data.longPct}%` }}
        />
      </div>
    </Card>
  );
}
 
// Card 3 – Smart Money Index
function SmartMoneyCard({ data }: { data: SmartMoneyIndex }) {
  const isBullish = data.label === "BULLISH";
  return (
    <Card>
      <CardTitle color="text-yellow-400">Smart Money Index</CardTitle>
      <div className="mt-6 text-center">
        <div className="text-7xl font-bold text-yellow-400">{data.value}</div>
        <div
          className={`text-lg font-bold mt-1 ${
            isBullish ? "text-green-400" : "text-red-400"
          }`}
        >
          {data.label}
        </div>
        <p className="text-xs text-gray-500 mt-3">Updated: {data.updatedAt}</p>
      </div>
    </Card>
  );
}
 
// Card 4 – COT Positioning History
function COTHistoryCard({ history }: { history: COTData["history"] }) {
  return (
    <Card>
      <CardTitle color="text-yellow-400">COT Positioning History</CardTitle>
      <div className="mt-4 space-y-3">
        {history.map((row) => (
          <div key={row.week} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-16 shrink-0">{row.week}</span>
            <div className="flex-1 bg-[#2a2d40] rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-700"
                style={{ width: `${row.pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-300 w-8 text-right">{row.pct}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
 
// Card 5 – Flow Summary
function FlowSummaryCard({ data }: { data: COTData }) {
  const rows = [
    {
      label: "Institutional Net Position",
      value: signed(data.netNonCommercial),
      color: "text-white",
    },
    {
      label: "Managed Money Long",
      value: fmt(data.managedMoneyLong),
      color: "text-white",
    },
    {
      label: "Managed Money Short",
      value: fmt(data.managedMoneyShort),
      color: "text-red-400",
    },
    {
      label: "Commercial Hedgers",
      value: `-${fmt(data.commercialHedgers)}`,
      color: "text-red-400",
    },
    {
      label: "Non-Reportable",
      value: fmt(data.nonReportable),
      color: "text-white",
    },
  ];
 
  return (
    <Card>
      <CardTitle color="text-yellow-400">Flow Summary</CardTitle>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between text-sm border-b border-[#2a2d40] pb-2 last:border-0">
            <span className="text-gray-400">{row.label}</span>
            <span className={`font-semibold ${row.color}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
 
// ─── Main page ────────────────────────────────────────────────────────────────
export default function InstitutionalFlow() {
  const [cot, setCot] = useState<COTData>(MOCK_COT);
  const [sentiment, setSentiment] = useState<RetailSentiment>(MOCK_SENTIMENT);
  const [smi, setSmi] = useState<SmartMoneyIndex>(MOCK_SMI);
  const [livePrice, setLivePrice] = useState<number>(4092.8);
  const [isLive] = useState(true);
 
  // Simulate live price tick (replace with real WebSocket)
  useEffect(() => {
    const id = setInterval(() => {
      setLivePrice((p) => +(p + (Math.random() - 0.5) * 0.5).toFixed(2));
    }, 3000);
    return () => clearInterval(id);
  }, []);
 
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col">
      {/* Main content */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Institutional Flow Analysis
          </h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isLive ? "bg-green-400 animate-pulse" : "bg-gray-500"
              }`}
            />
            <span>
              {isLive ? "Live from MT5 + Tailscale" : "Disconnected"} |{" "}
              <span className="text-white font-semibold">${livePrice.toFixed(2)}</span>
            </span>
          </div>
        </div>
 
        {/* Top row: 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <COTReportCard data={cot} />
          <RetailSentimentCard data={sentiment} />
          <SmartMoneyCard data={smi} />
        </div>
 
        {/* Bottom row: 2 cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <COTHistoryCard history={cot.history} />
          <FlowSummaryCard data={cot} />
        </div>
      </div>
 
      {/* Footer */}
      <footer className="mt-8 border-t border-[#1e2130] px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-gray-500">
          {/* Left: risk warning + copyright */}
          <div className="space-y-1">
            <p>
              <span className="text-red-400 font-semibold">Risk Warning:</span>{" "}
              Trading foreign exchange on margin carries a high level of risk and may not be suitable for all investors.
            </p>
            <p>
              © 2026 FARONE.AI — Powered by MetaTrader 5 |{" "}
              <a
                href="mailto:farone2013@gmail.com"
                className="text-gray-400 hover:text-yellow-400 transition-colors"
              >
                farone2013@gmail.com
              </a>{" "}
              for licensing
            </p>
          </div>
 
          {/* Right: authors */}
          <div className="text-right">
            <p className="text-gray-600 mb-0.5">Authors</p>
            <p>
              <span className="text-yellow-400 font-semibold">Setiawan F</span>
              {" | "}
              <span className="text-yellow-400 font-semibold">Selviana R</span>
            </p>
            <p className="text-gray-600">Founder @ Aitopia</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
