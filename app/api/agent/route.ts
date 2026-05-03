import { NextRequest, NextResponse } from 'next/server'
import { handleMessage, resetState } from '@/agent'
import { ChatMessage, WalletInfo, BookingResult } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      message,
      history = [],
      userWallet,
      bookingResult,
      calendarToken,
      attendeeEmails,
    }: {
      message: string
      history: ChatMessage[]
      userWallet?: WalletInfo
      bookingResult?: BookingResult
      calendarToken?: string
      attendeeEmails?: string[]
    } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Handle reset command
    if (message.trim().toLowerCase() === '/reset') {
      resetState()
      return NextResponse.json({
        response: 'Agent state cleared. How can I help you?',
        toolCalls: [],
      })
    }

    const result = await handleMessage(message, history, {
      userWallet,
      calendarToken,
      attendeeEmails,
      bookingResult,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Agent route error:', error)
    return NextResponse.json(
      { error: 'Internal server error', response: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
