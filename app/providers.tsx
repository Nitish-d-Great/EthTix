'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/wagmi.config'
import { useState, useEffect } from 'react'

// Clear stale wagmi state from localStorage on mount
function ClearStaleState() {
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage)
      for (const key of keys) {
        if (key.includes('wagmi') || key.includes('wallet') || key.includes('connector')) {
          localStorage.removeItem(key)
        }
      }
    } catch {}
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ClearStaleState />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
