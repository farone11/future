import { type ReactNode, useEffect, useState, useRef } from 'react'
import Sidebar from './Sidebar'

interface PageLayoutProps {
  title: string
  subtitle?: string
  badge?: string
  badgeColor?: string
  children: ReactNode
}

interface TickerData {
  price: string
  spread: number
  swapLong: number
  swapShort: number
}

// ── Fetch gold price dari MT5_LIVE atau fallback ke free API ──────────────────
async function fetchTickerData(): Promise<TickerData | null> {
  try {
    // Ganti URL ini dengan endpoint MT5 live kamu jika ada
    // Contoh: const res = await fetch('/api/gold-price')
    // Sementara pakai metals-api / gold-api publik sebagai demo
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d',
      { cache: 'no-store' }
    )
    if (!res.ok) throw new Error('fetch failed')
    const json = await res.json()
    const price: number =
      json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0
    if (!price) throw new Error('no price')
    return {
      price: price.toFixed(2),
      spread: 15,       // ganti dengan data live jika tersedia
      swapLong: -8.5,
      swapShort: 2.1,
    }
  } catch {
    return null
  }
}

// ── Komponen marquee realtime ─────────────────────────────────────────────────
function RealtimeTicker() {
  const [ticker, setTicker] = useState<TickerData>({
    price: '—',
    spread: 15,
    swapLong: -8.5,
    swapShort: 2.1,
  })
  const [isLive, setIsLive] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = async () => {
    const data = await fetchTickerData()
    if (data) {
      setTicker(data)
      setIsLive(true)
    }
  }

  useEffect(() => {
    refresh()                                    // fetch segera
    intervalRef.current = setInterval(refresh, 30_000) // refresh tiap 30 detik
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const swapShortSign = ticker.swapShort >= 0 ? '+' : ''
  const swapLongSign  = ticker.swapLong  >= 0 ? '+' : ''

  const tickerText = [
    '⚡ FUTURISTIC GOLD TRADING ANALYTICS',
    `⚡ XAUUSD LIVE: $${ticker.price}`,
    `⚡ SPREAD: ${ticker.spread}`,
    `⚡ SWAP LONG: ${swapLongSign}${ticker.swapLong}`,
    `⚡ SWAP SHORT: ${swapShortSign}${ticker.swapShort}`,
  ].join('  ')

  // Duplikasi 3x supaya marquee seamless tanpa gap
  const content = `${tickerText}  ·  ${tickerText}  ·  ${tickerText}`

  return (
    <div className="w-full bg-gradient-to-r from-emerald-800 to-blue-700 sticky top-0 z-20">
      <div className="bg-black/40 overflow-hidden relative">
        {/* Live dot indicator */}
        {isLive && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          </span>
        )}

        {/*
          Kunci fix marquee realtime:
          - Gunakan CSS animation `ticker-scroll` via inline style,
            bukan Tailwind `animate-marquee` (sering tidak didefinisikan).
          - translateX dari 0 → -50% karena konten di-duplikasi,
            sehingga loop seamless tanpa lompatan.
          - will-change: transform agar GPU-accelerated.
        */}
        <div
          className="whitespace-nowrap py-2 pl-6"
          style={{
            display: 'inline-block',
            animation: 'ticker-scroll 40s linear infinite',
            willChange: 'transform',
          }}
        >
          <span className="text-cyan-300 text-xs lg:text-sm font-semibold">
            {content}
          </span>
        </div>

        {/* Keyframe injected sekali via style tag */}
        <style>{`
          @keyframes ticker-scroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-33.333%); }
          }
        `}</style>
      </div>
    </div>
  )
}

// ── Layout utama ──────────────────────────────────────────────────────────────
export default function PageLayout({
  title,
  subtitle,
  badge,
  badgeColor = 'text-green-400',
  children,
}: PageLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0c] text-white font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col transition-all duration-300 lg:ml-0 overflow-x-hidden">

        {/* === RUNNING TEXT REALTIME === */}
        <RealtimeTicker />

        {/* === BANNER === */}
        <div className="w-full bg-black">
          <img
            src="/layout_08.png"
            alt="Banner"
            className="w-full h-auto object-cover object-center"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>

        <div className="flex-1 p-4 lg:p-6">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-white font-bold text-xl lg:text-2xl tracking-wide uppercase">
              {title}
            </h1>

            {subtitle && (
              <div className="text-gray-400 text-xs lg:text-sm mt-1">
                {subtitle}
              </div>
            )}

            {badge && (
              <div className={`text-xs mt-2 flex items-center gap-1 ${badgeColor}`}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span>{badge}</span>
              </div>
            )}
          </div>

          {children}
        </div>

        {/* Footer */}
        <footer className="border-t border-[#1e1e24] px-4 lg:px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between text-xs text-gray-600 gap-3">
          <div>
            <span className="text-red-400 font-semibold">Risk Warning:</span>{' '}
            Trading foreign exchange on margin carries a high level of risk.
            <br />© 2026 FARONE.AI — Powered by MetaTrader 5 | Contact:{' '}
            admin@faronecapital.online
          </div>
          <div className="text-left lg:text-right shrink-0">
            <div className="text-gray-500 mb-1">Authors</div>
            <div>
              <span className="text-yellow-400">Setiawan F</span>
              <span className="text-gray-500"> | </span>
              <span className="text-yellow-400">Selviana R</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
