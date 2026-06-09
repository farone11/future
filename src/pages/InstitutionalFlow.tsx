import { useEffect, useState, useRef } from "react";
 
// ─── Types ────────────────────────────────────────────────────────────────────
interface CotData {
  asOf: string;
  netNonCommercial: number | null;
  longPositions: number | null;
  shortPositions: number | null;
  managedMoneyLong: number | null;
  managedMoneyShort: number | null;
  commercialHedgers: number | null;
  nonReportable: number | null;
  history: { week: number; pct: number }[];
}
 
interface SentimentData {
  longPct: number | null;
  shortPct: number | null;
}
 
interface SmartMoneyData {
  value: number | null;
  signal: string | null;
  updated: string | null;
}
 
interface FlowState {
  cot: CotData;
  sentiment: SentimentData;
  smartMoney: SmartMoneyData;
  isLive: boolean;
  lastUpdate: string;
}
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number | null, dec = 0) =>
  n == null ? "---,---" : n.toLocaleString("en-US", { maximumFractionDigits: dec });
 
const pct = (n: number | null) => (n == null ? "--%": `${n.toFixed(1)}%`);
 
const signalColor = (signal: string | null) => {
  if (!signal) return "#a0a0a0";
  const s = signal.toLowerCase();
  if (s.includes("bull") || s.includes("long") || s.includes("buy")) return "#22c55e";
  if (s.includes("bear") || s.includes("short") || s.includes("sell")) return "#ef4444";
  return "#f5c518";
};
 
// ─── Sub-components ───────────────────────────────────────────────────────────
function LiveBadge({ live }: { live: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: live ? "#22c55e" : "#ef4444",
          display: "inline-block",
          boxShadow: live ? "0 0 6px #22c55e" : "none",
          animation: live ? "pulse 2s infinite" : "none",
        }}
      />
      <span style={{ color: live ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
        {live ? "Live from MT5 + Tailscale" : "Disconnected"}
      </span>
    </div>
  );
}
 
function Card({
  title,
  subtitle,
  accent = "#f5c518",
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#111418",
        border: "1px solid #2a2d35",
        borderRadius: 8,
        padding: "20px 24px",
        flex: 1,
        minWidth: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* accent top border */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }}
      />
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ color: accent, fontSize: 13, fontWeight: 700, letterSpacing: 1, margin: 0, textTransform: "uppercase" }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0", fontWeight: 400 }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
 
function CotBar({ week, pct: value }: { week: number; pct: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 10,
      }}
    >
      <span style={{ color: "#6b7280", fontSize: 12, width: 56, flexShrink: 0 }}>
        Week -{week}
      </span>
      <div
        style={{
          flex: 1,
          background: "#1e2229",
          borderRadius: 4,
          height: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: "linear-gradient(90deg, #f5c518, #d4a017)",
            borderRadius: 4,
            transition: "width 0.8s ease",
          }}
        />
      </div>
      <span style={{ color: "#e0e0e0", fontSize: 12, width: 32, textAlign: "right", flexShrink: 0 }}>
        {value}%
      </span>
    </div>
  );
}
 
function FlowSummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #1e2229",
      }}
    >
      <span style={{ color: "#9ca3af", fontSize: 13 }}>{label}</span>
      <span style={{ color: color || "#e0e0e0", fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
 
// ─── Mock / fallback data generator ──────────────────────────────────────────
function getMockData(): FlowState {
  return {
    isLive: false,
    lastUpdate: new Date().toLocaleTimeString(),
    cot: {
      asOf: "--/--/--",
      netNonCommercial: null,
      longPositions: null,
      shortPositions: null,
      managedMoneyLong: null,
      managedMoneyShort: null,
      commercialHedgers: null,
      nonReportable: null,
      history: [
        { week: 1, pct: 65 },
        { week: 2, pct: 57 },
        { week: 3, pct: 49 },
        { week: 4, pct: 41 },
      ],
    },
    sentiment: { longPct: null, shortPct: null },
    smartMoney: { value: null, signal: null, updated: null },
  };
}
 
// ─── Live data fetcher (connects to MT5 backend via /api/institutional-flow) ──
async function fetchLiveData(): Promise<Partial<FlowState>> {
  try {
    const res = await fetch("/api/institutional-flow", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error("non-200");
    const json = await res.json();
    return { ...json, isLive: true, lastUpdate: new Date().toLocaleTimeString() };
  } catch {
    return {};
  }
}
 
// ─── Main Component ───────────────────────────────────────────────────────────
export default function InstitutionalFlow() {
  const [state, setState] = useState<FlowState>(getMockData());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
 
  const refresh = async () => {
    const live = await fetchLiveData();
    if (live && live.isLive) {
      setState((prev) => ({ ...prev, ...live }));
    }
  };
 
  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
 
  const { cot, sentiment, smartMoney, isLive } = state;
 
  // ── Derived net non-commercial display ────────────────────────────────────
  const netDisplay =
    cot.netNonCommercial == null
      ? "---,---"
      : cot.netNonCommercial > 0
      ? `+${fmt(cot.netNonCommercial)}`
      : fmt(cot.netNonCommercial);
 
  const institutionalNetPos =
    cot.managedMoneyLong != null && cot.managedMoneyShort != null
      ? `${fmt(cot.managedMoneyLong - cot.managedMoneyShort)}`
      : "---";
 
  return (
    <div
      style={{
        background: "#0c0e12",
        minHeight: "100vh",
        padding: "28px 24px",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: "#e0e0e0",
      }}
    >
      {/* ── Keyframe for pulse ─────────────────────────────────────────────── */}
      <style>{`
        @keyframes pulse {
          0%,100%{opacity:1}50%{opacity:.4}
        }
        @keyframes fadeIn {
          from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}
        }
        .if-row{animation:fadeIn .4s ease both}
      `}</style>
 
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 1.5,
              margin: 0,
              color: "#ffffff",
              textTransform: "uppercase",
            }}
          >
            Institutional Flow Analysis
          </h1>
        </div>
        <div style={{ marginTop: 6 }}>
          <LiveBadge live={isLive} />
        </div>
      </div>
 
      {/* ── Top Row: CFTC COT | Retail Sentiment | Smart Money ─────────────── */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* CFTC COT Report */}
        <Card title="CFTC COT Report" subtitle={`As of ${cot.asOf}`} accent="#f5c518">
          <div
            style={{
              textAlign: "center",
              padding: "12px 0 16px",
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: cot.netNonCommercial == null ? "#6b7280" : cot.netNonCommercial >= 0 ? "#f5c518" : "#ef4444",
                letterSpacing: 2,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {cot.netNonCommercial == null ? "---,---" : netDisplay}
            </span>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "6px 0 0" }}>Net Non-Commercial</p>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              paddingTop: 12,
              borderTop: "1px solid #1e2229",
            }}
          >
            <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>
              Long: {fmt(cot.longPositions)}
            </span>
            <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
              Short: {fmt(cot.shortPositions)}
            </span>
          </div>
        </Card>
 
        {/* Retail Sentiment SWFX */}
        <Card title="Retail Sentiment SWFX" subtitle="Live MT5" accent="#22c55e">
          <div style={{ textAlign: "center", padding: "8px 0 12px" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 14 }}>
              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#22c55e",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pct(sentiment.longPct)}
                </div>
                <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>Long</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#ef4444",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pct(sentiment.shortPct)}
                </div>
                <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>Short</div>
              </div>
            </div>
 
            {/* Sentiment Bar */}
            <div
              style={{
                background: "#1e2229",
                borderRadius: 6,
                height: 10,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: sentiment.longPct != null ? `${sentiment.longPct}%` : "50%",
                  background: "linear-gradient(90deg, #22c55e, #16a34a)",
                  borderRadius: 6,
                  transition: "width 0.8s ease",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ color: "#22c55e", fontSize: 10 }}>LONG</span>
              <span style={{ color: "#ef4444", fontSize: 10 }}>SHORT</span>
            </div>
          </div>
        </Card>
 
        {/* Smart Money Index */}
        <Card title="Smart Money Index" accent="#a78bfa">
          <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                color:
                  smartMoney.value == null
                    ? "#f5c518"
                    : signalColor(smartMoney.signal),
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              {smartMoney.value == null ? "undefined" : fmt(smartMoney.value, 2)}
            </div>
            <div
              style={{
                color: signalColor(smartMoney.signal),
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {smartMoney.signal ?? "undefined"}
            </div>
            <div style={{ color: "#6b7280", fontSize: 11 }}>
              Updated: {smartMoney.updated ?? "undefined"}
            </div>
          </div>
        </Card>
      </div>
 
      {/* ── Bottom Row: COT History | Flow Summary ──────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {/* COT Positioning History */}
        <div style={{ flex: "1 1 380px", minWidth: 300 }}>
          <Card title="COT Positioning History" accent="#f5c518">
            <div style={{ marginTop: 4 }}>
              {cot.history.map((h) => (
                <CotBar key={h.week} week={h.week} pct={h.pct} />
              ))}
              {cot.history.length === 0 && (
                <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center", marginTop: 16 }}>
                  No data available
                </p>
              )}
            </div>
          </Card>
        </div>
 
        {/* Flow Summary */}
        <div style={{ flex: "1 1 380px", minWidth: 300 }}>
          <Card title="Flow Summary" accent="#f5c518">
            <div>
              <FlowSummaryRow
                label="Institutional Net Position"
                value={institutionalNetPos}
                color={
                  cot.managedMoneyLong != null && cot.managedMoneyShort != null
                    ? cot.managedMoneyLong > cot.managedMoneyShort
                      ? "#22c55e"
                      : "#ef4444"
                    : "#6b7280"
                }
              />
              <FlowSummaryRow
                label="Managed Money Long"
                value={fmt(cot.managedMoneyLong)}
                color="#22c55e"
              />
              <FlowSummaryRow
                label="Managed Money Short"
                value={fmt(cot.managedMoneyShort)}
                color="#ef4444"
              />
              <FlowSummaryRow
                label="Commercial Hedgers"
                value={fmt(cot.commercialHedgers)}
                color="#a78bfa"
              />
              <FlowSummaryRow
                label="Non-Reportable"
                value={fmt(cot.nonReportable)}
              />
            </div>
 
            {/* Last update footer */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid #1e2229",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: "#4b5563", fontSize: 11 }}>
                Auto-refresh every 30s
              </span>
              <span style={{ color: "#4b5563", fontSize: 11 }}>
                Last: {state.lastUpdate}
              </span>
            </div>
          </Card>
        </div>
      </div>
 
      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 40,
          borderTop: "1px solid #1e2229",
          paddingTop: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {/* Left: Risk Warning + Copyright */}
        <div>
          <p
            style={{
              color: "#6b7280",
              fontSize: 10,
              margin: "0 0 4px",
              maxWidth: 600,
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "#9ca3af", fontWeight: 600 }}>Risk Warning: </span>
            Trading foreign exchange on margin carries a high level of risk.
          </p>
          <p style={{ color: "#4b5563", fontSize: 10, margin: 0 }}>
            © 2026 FARONE.AI — Powered by MetaTrader 5 | Contact: admin@faronecapital.online
          </p>
        </div>
 
        {/* Right: Authors */}
        <div style={{ textAlign: "right" }}>
          <p style={{ color: "#4b5563", fontSize: 10, margin: "0 0 2px", letterSpacing: 0.5 }}>
            Authors
          </p>
          <p
            style={{
              color: "#9ca3af",
              fontSize: 11,
              margin: 0,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            Setiawan F | Selviana R
          </p>
        </div>
      </div>
    </div>
  );
}
