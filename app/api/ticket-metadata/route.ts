import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const event = searchParams.get('event') || 'EthTix Event'
  const attendee = searchParams.get('attendee') || 'Attendee'
  const venue = searchParams.get('venue') || 'Event Venue'
  const date = searchParams.get('date') || 'TBA'
  const price = searchParams.get('price') || '0'
  const image = searchParams.get('image') || ''
  const tokenId = searchParams.get('tokenId') || '0'

  const priceDisplay = price === '0' || price === 'FREE' ? 'FREE' : `$${price}`

  const metadata = {
    name: `EthTix Ticket #${tokenId} — ${event}`,
    symbol: 'ETHTIX',
    description: `On-chain event ticket for "${event}" at ${venue}. Minted via EthTix on Ethereum Sepolia.`,
    image: image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
    external_url: `https://sepolia.etherscan.io`,
    attributes: [
      { trait_type: 'Event', value: event },
      { trait_type: 'Venue', value: venue },
      { trait_type: 'Date', value: date },
      { trait_type: 'Attendee', value: attendee },
      { trait_type: 'Price', value: priceDisplay },
      { trait_type: 'Platform', value: 'EthTix' },
      { trait_type: 'Network', value: 'Ethereum Sepolia' },
    ],
    properties: {
      category: 'ticket',
      files: image ? [{ uri: image, type: 'image/jpeg' }] : [],
    },
  }

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'application/json',
    },
  })
}
