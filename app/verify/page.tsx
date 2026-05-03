'use client'

import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { TICKET_MANAGER_ABI } from '@/lib/abi/TicketManager'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`

interface VerificationResult {
  isValid: boolean
  eventId: string
  eventName: string
  attendeeName: string
  venue: string
  date: string
  status: string
  tokenId: number
}

export default function VerifyPage() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const [tokenId, setTokenId] = useState('')
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [redeemSuccess, setRedeemSuccess] = useState(false)

  const handleVerify = async () => {
    if (!tokenId) return
    setIsVerifying(true)
    setError(null)
    setResult(null)
    setRedeemSuccess(false)

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: parseInt(tokenId) }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Verification failed')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleRedeem = async () => {
    if (!result || !address) return
    setIsRedeeming(true)
    setError(null)

    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: TICKET_MANAGER_ABI,
        functionName: 'redeemTicket',
        args: [BigInt(result.tokenId)],
      })
      setRedeemSuccess(true)
      setResult(prev => prev ? { ...prev, status: 'Redeemed', isValid: false } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Redemption failed')
    } finally {
      setIsRedeeming(false)
    }
  }

  const handleQRPaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const data = JSON.parse(e.target.value)
      if (data.tokenId !== undefined) {
        setTokenId(data.tokenId.toString())
      }
    } catch {
      // Not valid JSON, ignore
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 p-4 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">🎫 Ticket Verification</h1>
          <p className="text-gray-400 mt-1 text-sm">Scan QR or enter Token ID to verify</p>
        </div>

        {/* Input */}
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Token ID</label>
            <input
              type="number"
              value={tokenId}
              onChange={e => setTokenId(e.target.value)}
              placeholder="Enter token ID (e.g., 0, 1, 2...)"
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Or paste QR data</label>
            <textarea
              onChange={handleQRPaste}
              placeholder='Paste QR JSON: {"contractAddress":"...","tokenId":0,...}'
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary text-xs font-mono h-16 resize-none"
            />
          </div>

          <button
            onClick={handleVerify}
            disabled={!tokenId || isVerifying}
            className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-dark-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isVerifying ? 'Verifying...' : 'Verify Ticket'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-xl border p-6 ${
            result.isValid
              ? 'bg-accent/5 border-accent/30'
              : result.status === 'Redeemed'
              ? 'bg-yellow-500/5 border-yellow-500/30'
              : 'bg-red-500/5 border-red-500/30'
          }`}>
            {/* Status Badge */}
            <div className="flex items-center justify-between mb-4">
              <span className={`text-2xl`}>
                {result.isValid ? '✅' : result.status === 'Redeemed' ? '🔄' : '❌'}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                result.isValid
                  ? 'bg-accent/20 text-accent'
                  : result.status === 'Redeemed'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {result.status}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Event</span>
                <span className="text-white font-medium">{result.eventName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Attendee</span>
                <span className="text-white">{result.attendeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Venue</span>
                <span className="text-white">{result.venue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date</span>
                <span className="text-white">{result.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Token ID</span>
                <span className="text-white font-mono">#{result.tokenId}</span>
              </div>
            </div>

            {/* Check In Button */}
            {result.isValid && address && (
              <button
                onClick={handleRedeem}
                disabled={isRedeeming}
                className="w-full mt-4 py-3 bg-accent hover:bg-accent/80 disabled:bg-dark-600 text-dark-900 font-bold rounded-lg transition-colors text-lg"
              >
                {isRedeeming ? 'Processing...' : '✓ Check In'}
              </button>
            )}

            {redeemSuccess && (
              <p className="mt-3 text-center text-accent text-sm font-medium">
                Successfully checked in!
              </p>
            )}

            {!address && result.isValid && (
              <p className="mt-4 text-center text-gray-400 text-xs">
                Connect MetaMask to check in attendees
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
