import { NextRequest, NextResponse } from 'next/server'
import { executePendingBooking } from '@/agent'
import { ScrapedEvent, Attendee } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      event,
      attendees,
      userWallet,
      txHash,
      walletSignature,
      calendarToken,
      attendeeEmails,
      tokenId,
    }: {
      event: ScrapedEvent
      attendees: Attendee[]
      userWallet: string
      txHash?: string
      walletSignature?: string
      calendarToken?: string
      attendeeEmails?: string[]
      tokenId?: number
    } = body

    if (!event || !attendees || !userWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: event, attendees, userWallet' },
        { status: 400 }
      )
    }

    const result = await executePendingBooking(
      event,
      attendees,
      userWallet,
      txHash,
      walletSignature,
      calendarToken,
      attendeeEmails
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Execute booking error:', error)
    return NextResponse.json(
      { error: `Booking failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.` },
      { status: 500 }
    )
  }
}
