import { ScrapedEvent, TicketInfo, BookingResult, Attendee } from '@/types'
import { mintFreeTicketServer, getExplorerUrl, getContractAddress } from '@/lib/ethereum'

export async function executeBooking(
  event: ScrapedEvent,
  attendees: Attendee[],
  walletAddress: string,
  options: {
    txHash?: string;
    walletSignature?: string;
    tokenId?: number;
  }
): Promise<BookingResult> {
  const contractAddress = getContractAddress()
  const tickets: TicketInfo[] = []

  try {
    if (event.isFree && options.walletSignature) {
      // Free event: server-side minting for each attendee
      for (const attendee of attendees) {
        const name = attendee.name || 'Attendee'
        const metadataUri = buildMetadataUri(event, name, '0')

        const result = await mintFreeTicketServer(
          walletAddress,
          event.apiId,
          event.name,
          event.venue,
          event.date,
          name,
          metadataUri
        )

        tickets.push(buildTicketInfo(result.tokenId, result.txHash, contractAddress, event, name, 'FREE', walletAddress))
      }
    } else if (options.txHash) {
      // Paid event: client already executed, record the result
      const name = attendees[0]?.name || 'Attendee'
      const tokenId = options.tokenId ?? 0

      tickets.push(buildTicketInfo(tokenId, options.txHash, contractAddress, event, name, `$${event.price}`, walletAddress))
    } else {
      throw new Error('Missing transaction hash or wallet signature')
    }

    return {
      success: true,
      tickets,
      contractAddress,
      tokenIds: tickets.map(t => t.tokenId),
    }
  } catch (error) {
    return {
      success: false,
      tickets: [],
      contractAddress,
      tokenIds: [],
      error: error instanceof Error ? error.message : 'Booking failed',
    }
  }
}

function buildTicketInfo(
  tokenId: number,
  txHash: string,
  contractAddress: string,
  event: ScrapedEvent,
  attendeeName: string,
  price: string,
  walletAddress: string
): TicketInfo {
  const qrData = JSON.stringify({
    contractAddress,
    tokenId,
    wallet: walletAddress,
    eventId: event.apiId,
  })

  return {
    tokenId,
    contractAddress,
    txHash,
    explorerUrl: getExplorerUrl(txHash),
    qrData,
    eventName: event.name,
    venue: event.venue,
    date: event.date,
    attendeeName,
    price,
    status: 'Active',
  }
}

function buildMetadataUri(event: ScrapedEvent, attendeeName: string, price: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'
  const params = new URLSearchParams({
    event: event.name,
    venue: event.venue,
    date: event.date,
    attendee: attendeeName,
    price,
    image: event.coverUrl || '',
  })
  return `${baseUrl}/api/ticket-metadata?${params}`
}
