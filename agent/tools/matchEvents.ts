import { ScrapedEvent, EventMatch, UserIntent, AttendeeAvailability } from '@/types'

function parseEventDate(dateStr: string): Date | null {
  // Try ISO 8601 first (from Luma API)
  const isoDate = new Date(dateStr)
  if (!isNaN(isoDate.getTime())) return isoDate

  // Try natural format: "Mon May 5, 2026 6:00 PM"
  const naturalMatch = dateStr.match(/(\w+ \w+ \d+,? \d{4})\s*(.+)?/)
  if (naturalMatch) {
    const parsed = new Date(`${naturalMatch[1]} ${naturalMatch[2] || ''}`)
    if (!isNaN(parsed.getTime())) return parsed
  }

  return null
}

function detectTimeRange(text: string): { start: Date; end: Date } | null {
  const now = new Date()
  const lower = text.toLowerCase()

  if (lower.includes('today')) {
    const end = new Date(now)
    end.setHours(23, 59, 59)
    return { start: now, end }
  }

  if (lower.includes('tomorrow')) {
    const start = new Date(now)
    start.setDate(start.getDate() + 1)
    start.setHours(0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59)
    return { start, end }
  }

  if (lower.includes('this weekend')) {
    const dayOfWeek = now.getDay()
    const saturday = new Date(now)
    saturday.setDate(now.getDate() + (6 - dayOfWeek))
    saturday.setHours(0, 0, 0)
    const sunday = new Date(saturday)
    sunday.setDate(saturday.getDate() + 1)
    sunday.setHours(23, 59, 59)
    return { start: saturday, end: sunday }
  }

  if (lower.includes('this week')) {
    const end = new Date(now)
    const dayOfWeek = now.getDay()
    end.setDate(now.getDate() + (7 - dayOfWeek))
    end.setHours(23, 59, 59)
    return { start: now, end }
  }

  if (lower.includes('next week')) {
    const dayOfWeek = now.getDay()
    const nextMonday = new Date(now)
    nextMonday.setDate(now.getDate() + (8 - dayOfWeek))
    nextMonday.setHours(0, 0, 0)
    const nextSunday = new Date(nextMonday)
    nextSunday.setDate(nextMonday.getDate() + 6)
    nextSunday.setHours(23, 59, 59)
    return { start: nextMonday, end: nextSunday }
  }

  // "next N days"
  const daysMatch = lower.match(/next (\d+) days?/)
  if (daysMatch) {
    const days = parseInt(daysMatch[1])
    const end = new Date(now)
    end.setDate(now.getDate() + days)
    return { start: now, end }
  }

  // "this month"
  if (lower.includes('this month')) {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    return { start: now, end }
  }

  return null
}

function scoreEvent(
  event: ScrapedEvent,
  intent: UserIntent,
  timeRange: { start: Date; end: Date } | null,
  calendarData?: AttendeeAvailability[]
): { score: number; breakdown: EventMatch['breakdown']; calendarMatch: boolean; conflictDetails?: string } {
  let budget = 0
  let genre = 0
  let calendar = 0
  let temporal = 0
  let dayPreference = 0
  let base = 10 // base validity score

  const eventDate = parseEventDate(event.startAt)
  if (!eventDate) return { score: 0, breakdown: { budget: 0, genre: 0, calendar: 0, temporal: 0, dayPreference: 0, base: 0 }, calendarMatch: false }

  const now = new Date()

  // Hard filter: past events
  if (eventDate < now) return { score: 0, breakdown: { budget: 0, genre: 0, calendar: 0, temporal: 0, dayPreference: 0, base: 0 }, calendarMatch: false }

  // Hard filter: outside time range
  if (timeRange) {
    if (eventDate < timeRange.start || eventDate > timeRange.end) {
      return { score: 0, breakdown: { budget: 0, genre: 0, calendar: 0, temporal: 0, dayPreference: 0, base: 0 }, calendarMatch: false }
    }
  }

  // Budget scoring
  if (intent.budget !== null) {
    if (event.isFree) {
      budget = 25 // free is always within budget
    } else if (event.price <= intent.budget) {
      budget = 20 + (intent.budget - event.price > 10 ? 5 : 0) // bonus for well under budget
    } else {
      return { score: 0, breakdown: { budget: 0, genre: 0, calendar: 0, temporal: 0, dayPreference: 0, base: 0 }, calendarMatch: false } // over budget = hard exclude
    }
  } else {
    budget = 15 // no budget specified = neutral
  }

  // Genre matching
  if (intent.genres.length > 0) {
    const eventGenre = event.genre.toLowerCase()
    const eventName = event.name.toLowerCase()
    for (const g of intent.genres) {
      if (eventGenre.includes(g.toLowerCase()) || eventName.includes(g.toLowerCase())) {
        genre = 20
        break
      }
    }
  }

  // Day preference matching
  if (intent.preferredDays.length > 0) {
    const eventDay = eventDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    if (intent.preferredDays.some(d => d.toLowerCase() === eventDay)) {
      dayPreference = 25
    } else {
      dayPreference = 5
    }
  }

  // Temporal proximity (prefer sooner events)
  const daysAway = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysAway <= 14) {
    temporal = Math.max(0, 15 - daysAway)
  }

  // Calendar availability
  let calendarMatch = true
  let conflictDetails: string | undefined
  if (calendarData && calendarData.length > 0) {
    const allFree = calendarData.every(a => a.isFree)
    if (allFree) {
      calendar = 30
      calendarMatch = true
    } else {
      calendar = -20
      calendarMatch = false
      const busyNames = calendarData.filter(a => !a.isFree).map(a => a.email)
      conflictDetails = `Conflicts: ${busyNames.join(', ')}`
    }
  }

  const score = budget + genre + calendar + temporal + dayPreference + base
  return {
    score,
    breakdown: { budget, genre, calendar, temporal, dayPreference, base },
    calendarMatch,
    conflictDetails,
  }
}

export function matchEvents(
  events: ScrapedEvent[],
  intent: UserIntent,
  calendarData?: AttendeeAvailability[]
): EventMatch[] {
  // Detect time range from user preferences
  const timeRangeText = intent.preferredDays.join(' ') + ' ' + (intent.notes || '')
  const timeRange = detectTimeRange(timeRangeText)

  const scored: EventMatch[] = events
    .map(event => {
      const { score, breakdown, calendarMatch, conflictDetails } = scoreEvent(
        event,
        intent,
        timeRange,
        calendarData
      )
      return { event, score, breakdown, calendarMatch, conflictDetails }
    })
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, 5) // Return top 5 matches
}

export function formatMatchResults(matches: EventMatch[]): string {
  if (matches.length === 0) {
    return "I couldn't find any events matching your preferences. Would you like to try different criteria?"
  }

  let result = `I found **${matches.length} event${matches.length > 1 ? 's' : ''}** matching your preferences:\n\n`

  matches.forEach((match, index) => {
    const { event, calendarMatch, conflictDetails } = match
    const calendarIcon = calendarMatch ? '✅' : '⚠️'
    const priceStr = event.isFree ? 'FREE' : `$${event.price}`

    result += `**${index + 1}. ${event.name}**\n`
    result += `📍 ${event.venue} | 📅 ${event.date} | 💰 ${priceStr}\n`
    if (event.hosts.length > 0) result += `🎤 ${event.hosts.join(', ')}\n`
    if (event.guestCount > 0) result += `👥 ${event.guestCount} attending`
    if (event.spotsRemaining !== null) result += ` | ${event.spotsRemaining} spots left`
    result += '\n'
    result += `${calendarIcon} Calendar: ${calendarMatch ? 'Available' : conflictDetails || 'Conflict detected'}\n`
    result += '\n'
  })

  result += `\nWhich event would you like to book? Just tell me the number or name.`
  return result
}
