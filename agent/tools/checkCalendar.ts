import { AttendeeAvailability, TicketInfo } from '@/types'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export async function checkCalendarAvailability(
  calendarToken: string,
  emails: string[],
  eventStartAt: string,
  eventEndAt?: string
): Promise<AttendeeAvailability[]> {
  if (!calendarToken || emails.length === 0) {
    return []
  }

  try {
    const startTime = new Date(eventStartAt)
    // Check window: 30 min before to 3 hours after event start
    const timeMin = new Date(startTime.getTime() - 30 * 60 * 1000).toISOString()
    const timeMax = eventEndAt
      ? new Date(eventEndAt).toISOString()
      : new Date(startTime.getTime() + 3 * 60 * 60 * 1000).toISOString()

    const response = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calendarToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: 'UTC',
        items: emails.map(email => ({ id: email })),
      }),
    })

    if (!response.ok) {
      console.error('Calendar API error:', response.status)
      return emails.map(email => ({ email, isFree: true, busySlots: [] }))
    }

    const data = await response.json()
    const calendars = data.calendars || {}

    return emails.map(email => {
      const calendarData = calendars[email]
      const busySlots = calendarData?.busy || []
      return {
        email,
        isFree: busySlots.length === 0,
        busySlots: busySlots.map((slot: { start: string; end: string }) => ({
          start: slot.start,
          end: slot.end,
        })),
      }
    })
  } catch (error) {
    console.error('Calendar check failed:', error)
    // Return "free" as fallback so booking isn't blocked
    return emails.map(email => ({ email, isFree: true, busySlots: [] }))
  }
}

export async function createCalendarEvent(
  calendarToken: string,
  eventName: string,
  venue: string,
  startAt: string,
  endAt: string,
  ticketInfo: TicketInfo[],
  attendeeEmails: string[]
): Promise<{ success: boolean; eventLink?: string }> {
  if (!calendarToken) {
    return { success: false }
  }

  try {
    const description = buildCalendarDescription(ticketInfo)

    const calendarEvent = {
      summary: eventName,
      location: venue,
      description,
      start: {
        dateTime: startAt,
        timeZone: 'UTC',
      },
      end: {
        dateTime: endAt || new Date(new Date(startAt).getTime() + 2 * 60 * 60 * 1000).toISOString(),
        timeZone: 'UTC',
      },
      attendees: attendeeEmails.map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'email', minutes: 1440 },
        ],
      },
    }

    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calendarToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(calendarEvent),
    })

    if (!response.ok) {
      console.error('Calendar event creation failed:', response.status)
      return { success: false }
    }

    const data = await response.json()
    return { success: true, eventLink: data.htmlLink }
  } catch (error) {
    console.error('Calendar event creation error:', error)
    return { success: false }
  }
}

function buildCalendarDescription(tickets: TicketInfo[]): string {
  let desc = '🎫 EthTix Booking Confirmation\n\n'
  desc += '━━━━━━━━━━━━━━━━━━━━━━━━\n'
  desc += 'On-Chain Ticket Details:\n\n'

  for (const ticket of tickets) {
    desc += `• ${ticket.attendeeName}\n`
    desc += `  Token ID: #${ticket.tokenId}\n`
    desc += `  Verify: ${ticket.explorerUrl}\n\n`
  }

  desc += '━━━━━━━━━━━━━━━━━━━━━━━━\n'
  desc += 'Network: Ethereum Sepolia\n'
  desc += `Contract: ${tickets[0]?.contractAddress || 'N/A'}\n`
  desc += '\nTickets minted as ERC-721 NFTs via EthTix'

  return desc
}
