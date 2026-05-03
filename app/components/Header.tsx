'use client'

import { useAccount } from 'wagmi'

interface HeaderProps {
  calendarConnected: boolean
  calendarEmail?: string
  onConnectCalendar: () => void
}

export default function Header({ calendarConnected, calendarEmail, onConnectCalendar }: HeaderProps) {
  const { address } = useAccount()

  return (
    <header className="sticky top-0 z-50 bg-dark-800/80 backdrop-blur-md border-b border-dark-600">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl">🎫</span>
          <h1 className="text-lg font-bold text-white">
            Eth<span className="text-primary">Tix</span>
          </h1>
          <span className="text-xs text-gray-500 hidden sm:inline">AI Ticket Concierge</span>
        </div>

        {/* Right: Status Badges */}
        <div className="flex items-center gap-3">
          {/* Calendar */}
          {calendarConnected ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-700 rounded-full text-xs">
              <span className="text-accent">📅</span>
              <span className="text-gray-300">{calendarEmail?.split('@')[0] || 'Connected'}</span>
            </div>
          ) : (
            <button
              onClick={onConnectCalendar}
              className="px-2.5 py-1 bg-dark-700 hover:bg-dark-600 rounded-full text-xs text-gray-400 hover:text-white transition-colors"
            >
              📅 Connect Calendar
            </button>
          )}

          {/* Network */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-700 rounded-full text-xs">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse-dot" />
            <span className="text-gray-300">Sepolia</span>
          </div>

          {/* Wallet */}
          {address && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-dark-700 rounded-full text-xs">
              <span className="text-gray-300 font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
