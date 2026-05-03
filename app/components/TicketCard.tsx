'use client'

import { TicketInfo } from '@/types'
import QRCode from 'react-qr-code'

interface TicketCardProps {
  ticket: TicketInfo
}

export default function TicketCard({ ticket }: TicketCardProps) {
  return (
    <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-hidden max-w-sm">
      {/* Event Cover */}
      <div className="h-32 bg-gradient-to-br from-primary/30 to-secondary/30 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl">🎫</span>
        </div>
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs font-medium rounded-full border border-accent/30">
            On-Chain
          </span>
        </div>
      </div>

      {/* Event Details */}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-white text-sm truncate">{ticket.eventName}</h3>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Attendee</span>
            <p className="text-gray-200 truncate">{ticket.attendeeName}</p>
          </div>
          <div>
            <span className="text-gray-500">Price</span>
            <p className="text-gray-200">{ticket.price}</p>
          </div>
          <div>
            <span className="text-gray-500">Venue</span>
            <p className="text-gray-200 truncate">{ticket.venue}</p>
          </div>
          <div>
            <span className="text-gray-500">Date</span>
            <p className="text-gray-200 truncate">{ticket.date}</p>
          </div>
        </div>

        {/* On-Chain Details */}
        <div className="border-t border-dark-600 pt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Token ID</span>
            <span className="text-gray-200 font-mono">#{ticket.tokenId}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">TX Hash</span>
            <span className="text-gray-200 font-mono truncate max-w-[140px]">{ticket.txHash.slice(0, 10)}...</span>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex justify-center pt-2">
          <div className="bg-white p-2 rounded-lg">
            <QRCode value={ticket.qrData} size={100} level="H" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <a
            href={ticket.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-3 bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium text-center rounded-lg transition-colors"
          >
            View on Etherscan
          </a>
        </div>
      </div>
    </div>
  )
}
