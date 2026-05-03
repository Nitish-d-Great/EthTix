import { createPublicClient, createWalletClient, http, parseAbi, decodeEventLog } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { TICKET_MANAGER_ABI } from './abi/TicketManager'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.org'

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
})

export function getServerWalletClient() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY not configured')
  }
  const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY.replace('0x', '')}`)
  return createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC_URL),
  })
}

export async function mintFreeTicketServer(
  to: string,
  eventId: string,
  eventName: string,
  venue: string,
  date: string,
  attendeeName: string,
  tokenURI: string
): Promise<{ tokenId: number; txHash: string }> {
  const walletClient = getServerWalletClient()

  const txHash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: TICKET_MANAGER_ABI,
    functionName: 'mintFreeTicket',
    args: [to as `0x${string}`, eventId, eventName, venue, date, attendeeName, tokenURI],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  const tokenId = parseTicketPurchasedEvent(receipt)

  return { tokenId, txHash }
}

export async function verifyTicketOnChain(tokenId: number): Promise<{
  isValid: boolean;
  eventId: string;
  eventName: string;
  attendeeName: string;
  status: number;
}> {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TICKET_MANAGER_ABI,
    functionName: 'verifyTicket',
    args: [BigInt(tokenId)],
  }) as [boolean, string, string, string, number]

  return {
    isValid: result[0],
    eventId: result[1],
    eventName: result[2],
    attendeeName: result[3],
    status: result[4],
  }
}

export async function getTicketInfoOnChain(tokenId: number) {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TICKET_MANAGER_ABI,
    functionName: 'getTicketInfo',
    args: [BigInt(tokenId)],
  }) as {
    eventId: string;
    eventName: string;
    venue: string;
    date: string;
    attendeeName: string;
    pricePaid: bigint;
    status: number;
    mintTimestamp: bigint;
  }

  return {
    eventId: result.eventId,
    eventName: result.eventName,
    venue: result.venue,
    date: result.date,
    attendeeName: result.attendeeName,
    pricePaid: result.pricePaid.toString(),
    status: ['Active', 'Redeemed', 'Cancelled'][result.status] || 'Unknown',
    mintTimestamp: Number(result.mintTimestamp),
  }
}

export async function redeemTicketOnChain(tokenId: number): Promise<string> {
  const walletClient = getServerWalletClient()

  const txHash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: TICKET_MANAGER_ABI,
    functionName: 'redeemTicket',
    args: [BigInt(tokenId)],
  })

  await publicClient.waitForTransactionReceipt({ hash: txHash })
  return txHash
}

export function parseTicketPurchasedEvent(receipt: { logs: readonly { topics: string[]; data: string }[] }): number {
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: TICKET_MANAGER_ABI,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      })
      if (event.eventName === 'TicketPurchased') {
        return Number((event.args as { tokenId: bigint }).tokenId)
      }
    } catch {
      continue
    }
  }
  throw new Error('TicketPurchased event not found in transaction receipt')
}

export function getExplorerUrl(txHash: string): string {
  return `https://sepolia.etherscan.io/tx/${txHash}`
}

export function getTokenExplorerUrl(tokenId: number): string {
  return `https://sepolia.etherscan.io/token/${CONTRACT_ADDRESS}?a=${tokenId}`
}

export function getContractAddress(): string {
  return CONTRACT_ADDRESS
}
