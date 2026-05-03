import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { metaMask } from 'wagmi/connectors'

export const config = createConfig({
  chains: [sepolia],
  connectors: [metaMask()],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.org'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
