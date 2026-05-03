'use client'

import { useAccount, useConnect, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { useState, useEffect } from 'react'

const PLATFORM_FEE = '0.0001' // ETH
const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET as `0x${string}`

interface WalletGateProps {
  children: React.ReactNode
}

export default function WalletGate({ children }: WalletGateProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnectPending, error: connectError } = useConnect()
  const { sendTransaction, data: txHash, isPending: isSending, error: sendError } = useSendTransaction()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })
  const [accessGranted, setAccessGranted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Display errors from wagmi hooks
  useEffect(() => {
    if (connectError) setError(connectError.message)
  }, [connectError])

  useEffect(() => {
    if (sendError) setError(sendError.message)
  }, [sendError])

  // Grant access after payment confirmed
  useEffect(() => {
    if (isConfirmed && !accessGranted) setAccessGranted(true)
  }, [isConfirmed, accessGranted])

  if (accessGranted) {
    return <>{children}</>
  }

  const handleConnect = () => {
    setError(null)
    const connector = connectors[0]
    if (!connector) {
      setError('No wallet detected. Please install MetaMask.')
      return
    }
    connect({ connector })
  }

  const handlePayFee = () => {
    setError(null)
    if (!PLATFORM_WALLET) {
      setError('Platform wallet not configured')
      return
    }
    sendTransaction({
      to: PLATFORM_WALLET,
      value: parseEther(PLATFORM_FEE),
      gas: BigInt(21000),
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 p-4">
      <div className="w-full max-w-md bg-dark-800 rounded-2xl border border-dark-600 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎫</div>
          <h1 className="text-2xl font-bold text-white">EthTix</h1>
          <p className="text-gray-400 mt-1">AI-Powered Event Ticketing</p>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isConnected ? 'bg-accent text-dark-900' : 'bg-primary text-white'}`}>
            {isConnected ? '✓' : '1'}
          </div>
          <div className={`w-12 h-0.5 ${isConnected ? 'bg-accent' : 'bg-dark-600'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isConfirmed ? 'bg-accent text-dark-900' : isConnected ? 'bg-primary text-white' : 'bg-dark-600 text-gray-500'}`}>
            {isConfirmed ? '✓' : '2'}
          </div>
        </div>

        {/* Step 1: Connect Wallet */}
        {!isConnected && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Connect Wallet</h2>
            <p className="text-sm text-gray-400">
              Connect your MetaMask wallet to access the AI ticketing agent.
            </p>
            <button
              onClick={handleConnect}
              disabled={isConnectPending}
              className="w-full py-3 px-4 bg-primary hover:bg-primary/80 disabled:bg-dark-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isConnectPending ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          </div>
        )}

        {/* Step 2: Pay Platform Fee */}
        {isConnected && !isConfirmed && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Platform Access Fee</h2>
            <p className="text-sm text-gray-400">
              One-time fee of <span className="text-accent font-mono">{PLATFORM_FEE} ETH</span> to access the agent.
            </p>
            <div className="bg-dark-700 rounded-lg p-3 text-xs text-gray-300">
              <span className="text-gray-500">Connected:</span> {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
            <button
              onClick={handlePayFee}
              disabled={isSending || isConfirming}
              className="w-full py-3 px-4 bg-primary hover:bg-primary/80 disabled:bg-dark-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isSending ? 'Confirm in MetaMask...' : isConfirming ? 'Confirming on-chain...' : `Pay ${PLATFORM_FEE} ETH`}
            </button>
            {txHash && (
              <p className="text-xs text-gray-400 text-center">
                TX: <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{txHash.slice(0, 10)}...</a>
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}

        <p className="mt-6 text-xs text-gray-500 text-center">
          Ethereum Sepolia Testnet
        </p>
      </div>
    </div>
  )
}
