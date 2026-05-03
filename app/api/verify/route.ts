import { NextRequest, NextResponse } from 'next/server'
import { verifyTicketOnChain, getTicketInfoOnChain } from '@/lib/ethereum'

export async function POST(req: NextRequest) {
  try {
    const { tokenId } = await req.json()

    if (tokenId === undefined || tokenId === null) {
      return NextResponse.json({ error: 'tokenId is required' }, { status: 400 })
    }

    const verification = await verifyTicketOnChain(Number(tokenId))
    const ticketInfo = await getTicketInfoOnChain(Number(tokenId))

    return NextResponse.json({
      ...verification,
      ...ticketInfo,
      tokenId: Number(tokenId),
    })
  } catch (error) {
    console.error('Verify error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    )
  }
}
