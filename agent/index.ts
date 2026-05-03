import {
  ScrapedEvent, EventMatch, UserIntent, WalletInfo, WalletAction,
  TicketInfo, BookingResult, PendingBooking, ChatMessage,
  ToolCallResult, AgentResponse, ActionType, AttendeeAvailability, Attendee
} from '@/types'
import { getSystemPrompt } from './prompts/system'
import { fetchEvents } from './tools/fetchEvents'
import { matchEvents, formatMatchResults } from './tools/matchEvents'
import { checkCalendarAvailability, createCalendarEvent } from './tools/checkCalendar'
import { mintFreeTicketServer, getExplorerUrl, getContractAddress } from '@/lib/ethereum'
import { sendBookingConfirmation } from '@/lib/email'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ============================================
// Agent State (module-level, survives across requests in same instance)
// ============================================
interface AgentState {
  events: ScrapedEvent[]
  matches: EventMatch[]
  intent: UserIntent | null
  selectedEventIndex: number | null
  confirmationRequested: boolean
  paymentConfirmed: boolean
  bookingExecuted: boolean
  calendarChecked: boolean
  awaitingBookAnyway: boolean
  pendingConflictBooking: { event: ScrapedEvent; attendees: Attendee[] } | null
  lastBookingResult: { tickets: TicketInfo[]; contractAddress: string } | null
}

let state: AgentState = createInitialState()

function createInitialState(): AgentState {
  return {
    events: [],
    matches: [],
    intent: null,
    selectedEventIndex: null,
    confirmationRequested: false,
    paymentConfirmed: false,
    bookingExecuted: false,
    calendarChecked: false,
    awaitingBookAnyway: false,
    pendingConflictBooking: null,
    lastBookingResult: null,
  }
}

export function resetState() {
  state = createInitialState()
}

// ============================================
// Intent Classification
// ============================================
function classifyIntent(message: string): ActionType {
  const lower = message.toLowerCase().trim()

  // Context-aware: if awaiting "book anyway" confirmation
  if (state.awaitingBookAnyway) {
    if (/yes|proceed|book anyway|go ahead|confirm|do it/.test(lower)) return 'book_anyway'
    if (/no|cancel|different|alternative/.test(lower)) return 'cancel'
  }

  // Context-aware: if confirmation requested (user selecting an event number)
  if (state.confirmationRequested) {
    if (/^[1-5]$/.test(lower) || /^(first|second|third|fourth|fifth|option \d)/.test(lower)) return 'confirm_booking'
    if (/yes|confirm|book|that one|let's go|proceed/.test(lower)) return 'confirm_booking'
  }

  // Regex-based classification (order matters — more specific patterns first)
  if (/^(hi|hello|hey|greetings|good morning|good evening|sup|yo)\b/.test(lower)) return 'greeting'
  if (/email|send.*confirm|confirmation.*email|receipt/.test(lower)) return 'provide_email'
  if (/cancel|never ?mind|forget it|start over|reset/.test(lower)) return 'cancel'
  if (/check.*calendar|am i free|availability|schedule/.test(lower)) return 'check_calendar'
  if (/find|search|looking for|show me|discover|what.*events|any.*events|upcoming/.test(lower)) return 'search_events'
  if (/book|purchase|buy|get ticket|i want to (go|attend)|reserve|sign me up/.test(lower)) return 'book_ticket'
  return 'general_question'
}

// ============================================
// Intent Extraction via LLM
// ============================================
async function extractIntent(message: string, history: ChatMessage[]): Promise<UserIntent> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Extract user intent from their message. Return JSON with these fields:
- attendees: array of {name, email} (extract names/emails mentioned)
- budget: number or null (max $ they want to spend)
- preferredDays: array of strings (days/timeframes mentioned: "this weekend", "friday", "next week")
- genres: array of strings (event types: "crypto", "tech", "music", "art", "networking")
- location: string (city or area mentioned)
- checkCalendar: boolean (did they mention checking availability?)
- notes: string (any other relevant info)

Return ONLY valid JSON, no markdown.`
        },
        ...history.slice(-4).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: message }
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const text = completion.choices[0]?.message?.content || '{}'
    const cleaned = text.replace(/```json\n?|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      attendees: parsed.attendees || [],
      budget: parsed.budget || null,
      preferredDays: parsed.preferredDays || [],
      genres: parsed.genres || [],
      location: parsed.location || '',
      checkCalendar: parsed.checkCalendar || false,
      notes: parsed.notes || '',
    }
  } catch {
    return {
      attendees: [],
      budget: null,
      preferredDays: [],
      genres: [],
      location: '',
      checkCalendar: false,
    }
  }
}

// ============================================
// LLM Response Generation
// ============================================
async function generateResponse(
  message: string,
  history: ChatMessage[],
  context: string,
  calendarConnected: boolean,
  walletConnected: boolean
): Promise<string> {
  try {
    const systemPrompt = getSystemPrompt(calendarConnected, walletConnected)

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt + '\n\n' + context },
        ...history.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    return completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again."
  } catch (error) {
    console.error('LLM error:', error)
    return "I'm having trouble processing that right now. Please try again."
  }
}

// ============================================
// Main Message Handler
// ============================================
export async function handleMessage(
  message: string,
  history: ChatMessage[],
  context: {
    userWallet?: WalletInfo
    calendarToken?: string
    attendeeEmails?: string[]
    bookingResult?: BookingResult
  }
): Promise<AgentResponse> {
  const toolCalls: ToolCallResult[] = []
  const calendarConnected = !!context.calendarToken
  const walletConnected = !!context.userWallet

  // Restore booking result from client state (serverless functions lose module state)
  if (context.bookingResult && context.bookingResult.success) {
    state.bookingExecuted = true
    state.lastBookingResult = {
      tickets: context.bookingResult.tickets,
      contractAddress: context.bookingResult.contractAddress,
    }
  }

  // Classify intent
  const action = classifyIntent(message)

  switch (action) {
    case 'greeting':
      return handleGreeting(walletConnected, calendarConnected)

    case 'search_events':
    case 'book_ticket':
      return handleSearchEvents(message, history, context, toolCalls)

    case 'confirm_booking':
      return handleConfirmBooking(message, context, toolCalls)

    case 'book_anyway':
      return handleBookAnyway(context, toolCalls)

    case 'check_calendar':
      return handleCheckCalendar(context, toolCalls)

    case 'provide_email':
      return handleProvideEmail(message, context, toolCalls)

    case 'cancel':
      resetState()
      return {
        response: "No problem! I've cleared everything. What would you like to do?",
        toolCalls: [],
      }

    default:
      const response = await generateResponse(message, history, '', calendarConnected, walletConnected)
      return { response, toolCalls: [] }
  }
}

// ============================================
// Action Handlers
// ============================================

function handleGreeting(walletConnected: boolean, calendarConnected: boolean): AgentResponse {
  let greeting = "Hey! 👋 I'm **EthTix** — your AI concierge for live events on Ethereum.\n\n"
  greeting += "I can help you:\n"
  greeting += "- 🔍 Discover events happening near you\n"
  greeting += "- 🎫 Book tickets as on-chain NFTs\n"
  greeting += "- 📅 Check your calendar for conflicts\n\n"

  if (!walletConnected) {
    greeting += "**Connect your MetaMask wallet** to get started with booking!\n\n"
  }
  if (!calendarConnected) {
    greeting += "_Tip: Connect Google Calendar for automatic availability checking._\n\n"
  }

  greeting += "Just tell me what kind of events you're looking for — a city, a genre, a date range — and I'll find the best options!"

  return { response: greeting, toolCalls: [] }
}

async function handleSearchEvents(
  message: string,
  history: ChatMessage[],
  context: { userWallet?: WalletInfo; calendarToken?: string; attendeeEmails?: string[] },
  toolCalls: ToolCallResult[]
): Promise<AgentResponse> {
  // Step 1: Parse intent
  toolCalls.push({ tool: 'parse_intent', status: 'running', summary: 'Parsing your preferences...' })
  const intent = await extractIntent(message, history)
  state.intent = intent
  toolCalls[toolCalls.length - 1].status = 'completed'

  // Step 2: Discover events
  toolCalls.push({ tool: 'discover_events', status: 'running', summary: `Searching events in ${intent.location || 'your area'}...` })
  const location = intent.location || 'San Francisco' // default location
  const category = intent.genres.length > 0 ? intent.genres[0] : undefined
  const events = await fetchEvents(location, category)
  state.events = events
  toolCalls[toolCalls.length - 1].status = 'completed'
  toolCalls[toolCalls.length - 1].summary = `Found ${events.length} events`

  if (events.length === 0) {
    return {
      response: "I couldn't find any events matching your criteria. Try a different location or broader search terms?",
      toolCalls,
      events: [],
    }
  }

  // Step 3: Match and rank (without calendar data first for speed)
  toolCalls.push({ tool: 'match_events', status: 'running', summary: 'Ranking events by your preferences...' })
  let matches = matchEvents(events, intent)

  // Step 3b: Check calendar for top matched events individually (if connected)
  if (context.calendarToken && context.attendeeEmails && context.attendeeEmails.length > 0 && matches.length > 0) {
    toolCalls.push({ tool: 'check_calendars', status: 'running', summary: 'Checking calendar for top events...' })

    for (const match of matches) {
      try {
        const availability = await checkCalendarAvailability(
          context.calendarToken,
          context.attendeeEmails,
          match.event.startAt,
          match.event.endAt
        )
        const allFree = availability.every(a => a.isFree)
        match.calendarMatch = allFree
        if (!allFree) {
          const busyEmails = availability.filter(a => !a.isFree).map(a => a.email)
          match.conflictDetails = `Conflicts: ${busyEmails.join(', ')}`
        } else {
          match.conflictDetails = undefined
        }
      } catch {
        // Calendar check failed for this event, assume available
        match.calendarMatch = true
      }
    }

    state.calendarChecked = true
    toolCalls[toolCalls.length - 1].status = 'completed'
  }
  state.matches = matches
  state.confirmationRequested = true
  toolCalls[toolCalls.length - 1].status = 'completed'
  toolCalls[toolCalls.length - 1].summary = `${matches.length} events matched`

  const response = formatMatchResults(matches)

  return {
    response,
    toolCalls,
    events: matches.map(m => m.event),
  }
}

async function handleConfirmBooking(
  message: string,
  context: { userWallet?: WalletInfo; calendarToken?: string; attendeeEmails?: string[] },
  toolCalls: ToolCallResult[]
): Promise<AgentResponse> {
  // Parse selection
  const lower = message.toLowerCase()
  let selectedIndex = -1

  // Extract attendee names from this message (e.g., "book for Akash and Aman")
  const attendeeMatch = message.match(/(?:for|name of|names?)\s+(.+)/i)
  if (attendeeMatch) {
    const names = attendeeMatch[1].split(/\s*(?:and|,)\s*/).map(n => n.trim()).filter(Boolean)
    if (names.length > 0) {
      state.intent = state.intent || { attendees: [], budget: null, preferredDays: [], genres: [], location: '', checkCalendar: false }
      state.intent.attendees = names.map(name => ({ name }))
    }
  }

  // Try number — multiple patterns
  const numMatch = lower.match(/(\d)(?:st|nd|rd|th)?\s*(?:event|option)?/) || lower.match(/^(\d)$/) || lower.match(/option (\d)/) || lower.match(/number (\d)/)
  if (numMatch) {
    selectedIndex = parseInt(numMatch[1]) - 1
  } else if (/first|1st/.test(lower)) selectedIndex = 0
  else if (/second|2nd/.test(lower)) selectedIndex = 1
  else if (/third|3rd/.test(lower)) selectedIndex = 2
  else if (/fourth|4th/.test(lower)) selectedIndex = 3
  else if (/fifth|5th/.test(lower)) selectedIndex = 4
  else if (state.matches.length === 1) selectedIndex = 0 // only one option

  if (selectedIndex < 0 || selectedIndex >= state.matches.length) {
    return {
      response: "I didn't catch which event you'd like. Please tell me the number (1-" + state.matches.length + ") or the event name.",
      toolCalls: [],
    }
  }

  const selectedMatch = state.matches[selectedIndex]
  const event = selectedMatch.event
  state.selectedEventIndex = selectedIndex

  // Calendar conflict check
  if (!selectedMatch.calendarMatch && context.calendarToken) {
    state.awaitingBookAnyway = true
    state.pendingConflictBooking = {
      event,
      attendees: state.intent?.attendees || [{ name: 'Attendee' }],
    }
    return {
      response: `⚠️ There's a **calendar conflict** for **${event.name}**.\n\n${selectedMatch.conflictDetails}\n\nWould you like to **book anyway**, or should I find an alternative time?`,
      toolCalls: [],
    }
  }

  // Wallet gate
  if (!context.userWallet) {
    return {
      response: `Great choice! **${event.name}** is ${event.isFree ? 'free' : `$${event.price}`}.\n\n⚠️ Please **connect your MetaMask wallet** to proceed with booking.`,
      toolCalls: [],
    }
  }

  // Return pending booking for client to execute
  return buildBookingResponse(event, context, toolCalls)
}

async function handleBookAnyway(
  context: { userWallet?: WalletInfo; calendarToken?: string; attendeeEmails?: string[] },
  toolCalls: ToolCallResult[]
): Promise<AgentResponse> {
  state.awaitingBookAnyway = false

  if (!state.pendingConflictBooking) {
    return { response: "I don't have a pending booking. Would you like to search for events?", toolCalls: [] }
  }

  if (!context.userWallet) {
    return {
      response: "Please **connect your MetaMask wallet** to proceed with booking.",
      toolCalls: [],
    }
  }

  const event = state.pendingConflictBooking.event
  return buildBookingResponse(event, context, toolCalls)
}

function buildBookingResponse(
  event: ScrapedEvent,
  context: { userWallet?: WalletInfo; calendarToken?: string; attendeeEmails?: string[] },
  toolCalls: ToolCallResult[]
): AgentResponse {
  const contractAddress = getContractAddress()
  const attendees = state.intent?.attendees || [{ name: 'Attendee' }]
  const attendeeNames = attendees.map(a => a.name).join(', ')
  const ticketCount = attendees.length

  if (event.isFree) {
    // Free event: server-side minting for each attendee
    return {
      response: `Booking **${ticketCount} ticket${ticketCount > 1 ? 's' : ''}** for **${event.name}** (FREE event) for: ${attendeeNames}.\n\nJust sign the message in MetaMask to confirm — no ETH required.`,
      toolCalls,
      walletAction: {
        type: 'sign_message',
        message: `EthTix: Confirm ${ticketCount} free ticket(s) for "${event.name}" at ${event.venue} on ${event.date} — Attendees: ${attendeeNames}`,
      },
      pendingBooking: {
        event,
        attendees,
        requiresPayment: false,
      },
    }
  } else {
    // Paid event: one contract call per attendee
    // For multiple attendees, we charge platform fee per ticket
    const totalFee = BigInt(100000000000000) * BigInt(ticketCount) // 0.0001 ETH per ticket
    const firstAttendee = attendees[0]?.name || 'Attendee'
    const metadataUri = `${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/api/ticket-metadata?event=${encodeURIComponent(event.name)}&venue=${encodeURIComponent(event.venue)}&date=${encodeURIComponent(event.date)}&attendee=${encodeURIComponent(firstAttendee)}&price=${event.price}`

    return {
      response: `Booking **${ticketCount} ticket${ticketCount > 1 ? 's' : ''}** for **${event.name}** — ${event.isFree ? 'FREE' : `$${event.price}`} for: ${attendeeNames}.\n\n💳 Platform fee: **${(Number(totalFee) / 1e18).toFixed(4)} ETH** (${ticketCount} × 0.0001 ETH).\n\nPlease confirm the transaction in MetaMask.`,
      toolCalls,
      walletAction: {
        type: 'contract_write',
        address: contractAddress,
        functionName: 'purchaseTicket',
        args: [event.apiId, event.name, event.venue, event.date, attendeeNames, metadataUri],
        value: totalFee.toString(),
      },
      pendingBooking: {
        event,
        attendees,
        requiresPayment: true,
      },
    }
  }
}

async function handleCheckCalendar(
  context: { userWallet?: WalletInfo; calendarToken?: string; attendeeEmails?: string[] },
  toolCalls: ToolCallResult[]
): Promise<AgentResponse> {
  if (!context.calendarToken) {
    return {
      response: "Please **connect your Google Calendar** first (use the button in the header), then I can check availability.",
      toolCalls: [],
    }
  }
  if (!context.attendeeEmails || context.attendeeEmails.length === 0) {
    return {
      response: "I need attendee email addresses to check calendar availability. Who will be attending?",
      toolCalls: [],
    }
  }

  return {
    response: "Calendar is connected! I'll automatically check availability when we search for events. What events are you looking for?",
    toolCalls: [],
  }
}

async function handleProvideEmail(
  message: string,
  context: { userWallet?: WalletInfo; calendarToken?: string; attendeeEmails?: string[] },
  toolCalls: ToolCallResult[]
): Promise<AgentResponse> {
  if (!state.bookingExecuted || !state.lastBookingResult) {
    return {
      response: "I'll send a confirmation email after we complete a booking. Would you like to search for events first?",
      toolCalls: [],
    }
  }

  // Extract email from message
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = message.match(emailRegex)
  if (!emails || emails.length === 0) {
    return {
      response: "Please provide an email address. For example: *send confirmation to john@example.com*",
      toolCalls: [],
    }
  }

  const to = emails[0]
  toolCalls.push({ tool: 'send_email', status: 'running', summary: `Sending to ${to}...` })

  const success = await sendBookingConfirmation({
    to,
    bookingResult: state.lastBookingResult,
    userWalletAddress: context.userWallet?.address || '',
  })

  if (success) {
    toolCalls[toolCalls.length - 1].status = 'completed'
    toolCalls[toolCalls.length - 1].summary = `Sent to ${to}`
    return {
      response: `✅ Booking confirmation sent to **${to}**! Check your inbox.`,
      toolCalls,
    }
  } else {
    toolCalls[toolCalls.length - 1].status = 'error'
    toolCalls[toolCalls.length - 1].summary = 'Email send failed'
    return {
      response: `❌ Failed to send email to ${to}. Please check the address and try again.`,
      toolCalls,
    }
  }
}

// ============================================
// Execute Pending Booking (called after wallet confirmation)
// ============================================
export async function executePendingBooking(
  event: ScrapedEvent,
  attendees: Attendee[],
  walletAddress: string,
  txHash?: string,
  walletSignature?: string,
  calendarToken?: string,
  attendeeEmails?: string[]
): Promise<AgentResponse> {
  const toolCalls: ToolCallResult[] = []
  const tickets: TicketInfo[] = []
  const contractAddress = getContractAddress()

  toolCalls.push({ tool: 'execute_booking', status: 'running', summary: 'Minting NFT tickets...' })

  try {
    if (event.isFree && walletSignature) {
      // Server-side minting for free events
      for (const attendee of attendees) {
        const name = attendee.name || 'Attendee'
        const metadataUri = `${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/api/ticket-metadata?event=${encodeURIComponent(event.name)}&venue=${encodeURIComponent(event.venue)}&date=${encodeURIComponent(event.date)}&attendee=${encodeURIComponent(name)}&price=0`

        const result = await mintFreeTicketServer(
          walletAddress,
          event.apiId,
          event.name,
          event.venue,
          event.date,
          name,
          metadataUri
        )

        const qrData = JSON.stringify({
          contractAddress,
          tokenId: result.tokenId,
          wallet: walletAddress,
          eventId: event.apiId,
        })

        tickets.push({
          tokenId: result.tokenId,
          contractAddress,
          txHash: result.txHash,
          explorerUrl: getExplorerUrl(result.txHash),
          qrData,
          eventName: event.name,
          venue: event.venue,
          date: event.date,
          attendeeName: name,
          price: 'FREE',
          status: 'Active',
        })
      }
    } else if (txHash) {
      // Paid event: client already minted, we just record the result
      // Parse tokenId from transaction receipt would happen client-side
      // For now, create ticket info from available data
      const name = attendees[0]?.name || 'Attendee'
      const qrData = JSON.stringify({
        contractAddress,
        tokenId: 0, // Will be updated from client
        wallet: walletAddress,
        eventId: event.apiId,
      })

      tickets.push({
        tokenId: 0, // Updated by client from receipt
        contractAddress,
        txHash,
        explorerUrl: getExplorerUrl(txHash),
        qrData,
        eventName: event.name,
        venue: event.venue,
        date: event.date,
        attendeeName: name,
        price: `$${event.price}`,
        status: 'Active',
      })
    }

    toolCalls[toolCalls.length - 1].status = 'completed'
    toolCalls[toolCalls.length - 1].summary = `${tickets.length} ticket(s) minted`

    // Create calendar event if connected
    if (calendarToken && attendeeEmails && attendeeEmails.length > 0) {
      toolCalls.push({ tool: 'create_calendar_event', status: 'running', summary: 'Creating calendar event...' })
      const calResult = await createCalendarEvent(
        calendarToken,
        event.name,
        event.venue,
        event.startAt,
        event.endAt,
        tickets,
        attendeeEmails
      )
      toolCalls[toolCalls.length - 1].status = calResult.success ? 'completed' : 'error'
      toolCalls[toolCalls.length - 1].summary = calResult.success ? 'Calendar event created' : 'Calendar creation failed'
    }

    state.bookingExecuted = true
    state.confirmationRequested = false
    state.lastBookingResult = { tickets, contractAddress }

    let response = `🎫 **Booking Confirmed!**\n\n`
    response += `**${event.name}**\n`
    response += `📍 ${event.venue} | 📅 ${event.date}\n\n`
    response += `**On-Chain Details:**\n`
    for (const ticket of tickets) {
      response += `- ${ticket.attendeeName}: Token #${ticket.tokenId} | [View on Etherscan](${ticket.explorerUrl})\n`
    }
    response += `\nYour NFT ticket includes a QR code for venue check-in. Would you like me to send a confirmation email?`

    return {
      response,
      toolCalls,
      tickets,
      bookingResult: {
        success: true,
        tickets,
        contractAddress,
        tokenIds: tickets.map(t => t.tokenId),
      },
    }
  } catch (error) {
    toolCalls[toolCalls.length - 1].status = 'error'
    toolCalls[toolCalls.length - 1].summary = 'Minting failed'

    return {
      response: `❌ Booking failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      toolCalls,
    }
  }
}
