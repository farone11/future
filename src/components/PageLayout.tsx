import type { ReactNode } from 'react'
import Sidebar from './Sidebar'

interface PageLayoutProps {
  title: string
  subtitle?: string
  badge?: string
  badgeColor?: string
  children: ReactNode
}

export default function PageLayout({ 
  title, 
  subtitle, 
  badge,
  badgeColor = 'text-green-400', 
  children 
}: PageLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0c] text-white font-sans">
      <Sidebar />
      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col transition-all duration-300 lg:ml-0 overflow-x-hidden">

        {/* === RUNNING TEXT PALING ATAS === */}
        <div className="w-full bg-gradient-to-r from-emerald-800 to-blue-700 sticky top-0 z-20">
          <div className="bg-black/40 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap py-2">
              <span className="text-cyan-300 text-xs lg:text-sm font-semibold mx-6">
                ⚡ FUTURISTIC GOLD TRADING ANALYTICS ⚡ XAUUSD LIVE: $4475.91 ⚡ SPREAD: 15 ⚡ SWAP LONG: -8.5 ⚡ SWAP SHORT: +2.1 ⚡
              </span>
              <span className="text-cyan-300 text-xs lg:text-sm font-semibold mx-6">
                ⚡ FUTURISTIC GOLD TRADING ANALYTICS ⚡ XAUUSD LIVE: $4475.91 ⚡ SPREAD: 15 ⚡ SWAP LONG: -8.5 ⚡ SWAP SHORT: +2.1 ⚡
              </span>
            </div>
          </div>
        </div>

        {/* === BANNER === */}
        <div className="w-full bg-black">
          <img 
            src="/layout_08.png" 
            alt="Banner" 
            className="w-full h-auto object-cover object-center"
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
        </div>

        <div className="flex-1 p-4 lg:p-6">
          {/* Page header - judul per halaman */}
          <div className="mb-6">
            <h1 className="text-white font-bold text-xl lg:text-2xl tracking-wide uppercase">
              {title}
            </h1>

            {subtitle && <div className="text-gray-400 text-xs lg:text-sm mt-1">{subtitle}</div>}

            {/* FIX: Pake backtick ` bukan " atau ' */}
            {badge && (
              <div className={`text-xs mt-2 flex items-center gap-1 ${badgeColor}`}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                <span>{badge}</span>
              </div>
            )}
          </div>

          {children}
        </div>

        {/* Footer */}
        <footer className="border-t border-[#1e1e24] px-4 lg:px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between text-xs text-gray-600 gap-3">
          <div>
            <span className="text-red-400 font-semibold">Risk Warning:</span> Trading foreign exchange on margin carries a high level of risk.
            <br />© 2026 FARONE.AI — Powered by MetaTrader 5 | Contact: admin@faronecapital.online
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