import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { calendarToken, emails, timeMin, timeMax } = await req.json()

    if (!calendarToken || !emails || !timeMin || !timeMax) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calendarToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: 'UTC',
        items: emails.map((email: string) => ({ id: email })),
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Calendar API request failed' }, { status: response.status })
    }

    const data = await response.json()
    const calendars = data.calendars || {}

    const availability = emails.map((email: string) => {
      const cal = calendars[email]
      const busySlots = cal?.busy || []
      return {
        email,
        isFree: busySlots.length === 0,
        busySlots,
      }
    })

    return NextResponse.json({ availability })
  } catch (error) {
    console.error('FreeBusy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
