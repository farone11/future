import React from 'react'

interface MarqueeProps {
  goldPrice: number
  spread: number
}

export const Marquee: React.FC<MarqueeProps> = ({ goldPrice, spread }) => {
  return (
    <div className="bg-blue-900 text-yellow-400 py-1 overflow-hidden whitespace-nowrap border-b border-yellow-500/20">
      <div className="animate-marquee inline-block">
        <span className="mx-4">⚡ FUTURISTIC GOLD TRADING ANALYTICS ⚡</span>
        <span className="mx-4">XAUUSD LIVE: ${goldPrice?.toFixed(2) || '0.00'} ⚡</span>
        <span className="mx-4">SPREAD: {spread?.toFixed(0) || '0'} ⚡</span>
        <span className="mx-4">SWAP LONG: -8.5 ⚡</span>
        <span className="mx-4">SWAP SHORT: +2.1 ⚡</span>
        <span className="mx-4">FUTURISTIC GOLD TRADING ANALYTICS ⚡</span>
        <span className="mx-4">XAUUSD LIVE: ${goldPrice?.toFixed(2) || '0.00'} ⚡</span>
        <span className="mx-4">SPREAD: {spread?.toFixed(0) || '0'} ⚡</span>
      </div>
    </div>
  )
}