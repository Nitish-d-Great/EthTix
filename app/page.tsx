'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useSignMessage, useWriteContract } from 'wagmi'
import { v4 as uuidv4 } from 'uuid'
import { ChatMessage, ToolCallResult, AgentResponse, WalletAction, PendingBooking, BookingResult } from '@/types'
import { TICKET_MANAGER_ABI } from '@/lib/abi/TicketManager'
import WalletGate from './components/WalletGate'
import Header from './components/Header'
import ChatWindow from './components/ChatWindow'
import ToolCallPanel from './components/ToolCallPanel'

export default function Home() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { writeContractAsync } = useWriteContract()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallResult[]>([])
  const [calendarToken, setCalendarToken] = useState<string | null>(null)
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null)
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([])
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)

  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`

  // Extract emails from messages
  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    return text.match(emailRegex) || []
  }

  // Send message to agent
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return

    const foundEmails = extractEmails(text)
    if (foundEmails.length > 0) {
      setAttendeeEmails(prev => [...new Set([...prev, ...foundEmails])])
    }

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setActiveToolCalls([])

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
          userWallet: address ? { address, balance: '0', chainId: 11155111 } : undefined,
          calendarToken,
          attendeeEmails: [...attendeeEmails, ...foundEmails],
          bookingResult,
        }),
      })

      const data: AgentResponse = await response.json()
      setActiveToolCalls(data.toolCalls || [])

      // Handle wallet action if present
      if (data.walletAction && data.pendingBooking) {
        await handleWalletAction(data.walletAction, data.pendingBooking)
        return // Wallet action handler will add messages
      }

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: data.response,
        toolCalls: data.toolCalls,
        tickets: data.bookingResult?.tickets || data.tickets,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, assistantMessage])

      if (data.bookingResult) {
        setBookingResult(data.bookingResult)
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setActiveToolCalls([])
    }
  }, [messages, address, calendarToken, attendeeEmails, bookingResult])

  // Handle wallet actions from agent
  const handleWalletAction = async (action: WalletAction, booking: PendingBooking) => {
    try {
      if (action.type === 'sign_message' && action.message) {
        // Add pending message
        setMessages(prev => [...prev, {
          id: uuidv4(),
          role: 'assistant',
          content: `Booking **${booking.event.name}** (FREE). Please sign the message in MetaMask...`,
          timestamp: Date.now(),
        }])

        const signature = await signMessageAsync({ message: action.message })

        // Execute free booking
        const result = await fetch('/api/agent/execute-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: booking.event,
            attendees: booking.attendees,
            userWallet: address,
            walletSignature: signature,
            calendarToken,
            attendeeEmails,
          }),
        })
        const data = await result.json()
        if (data.bookingResult) setBookingResult(data.bookingResult)

        setMessages(prev => [...prev, {
          id: uuidv4(),
          role: 'assistant',
          content: data.response || '🎫 Tickets minted successfully!',
          tickets: data.tickets || data.bookingResult?.tickets,
          toolCalls: data.toolCalls,
          timestamp: Date.now(),
        }])

      } else if (action.type === 'contract_write' && action.functionName) {
        // Add pending message
        setMessages(prev => [...prev, {
          id: uuidv4(),
          role: 'assistant',
          content: `Booking **${booking.event.name}** ($${booking.event.price}). Please confirm the transaction in MetaMask...`,
          timestamp: Date.now(),
        }])

        const txHash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: TICKET_MANAGER_ABI,
          functionName: action.functionName as 'purchaseTicket',
          args: action.args as [string, string, string, string, string, string],
          value: action.value ? BigInt(action.value) : undefined,
        })

        // Record booking
        const result = await fetch('/api/agent/execute-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: booking.event,
            attendees: booking.attendees,
            userWallet: address,
            txHash,
            calendarToken,
            attendeeEmails,
          }),
        })
        const data = await result.json()
        if (data.bookingResult) setBookingResult(data.bookingResult)

        setMessages(prev => [...prev, {
          id: uuidv4(),
          role: 'assistant',
          content: data.response || '🎫 Tickets minted successfully!',
          tickets: data.tickets || data.bookingResult?.tickets,
          toolCalls: data.toolCalls,
          timestamp: Date.now(),
        }])
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'assistant',
        content: `❌ Transaction failed: ${error instanceof Error ? error.message : 'User rejected or transaction reverted'}. Please try again.`,
        timestamp: Date.now(),
      }])
    } finally {
      setIsLoading(false)
      setActiveToolCalls([])
    }
  }

  // Google Calendar OAuth
  const handleConnectCalendar = () => {
    window.location.href = '/api/auth/google'
  }

  // Handle OAuth callback on mount
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('calendar_token=')) {
      const params = new URLSearchParams(hash.slice(1))
      const token = params.get('calendar_token')
      const email = params.get('email')
      if (token) {
        setCalendarToken(token)
        if (email) {
          setCalendarEmail(email)
          setAttendeeEmails(prev => [...new Set([...prev, email])])
        }
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <WalletGate>
      <div className="h-screen flex flex-col bg-dark-900">
        <Header
          calendarConnected={!!calendarToken}
          calendarEmail={calendarEmail || undefined}
          onConnectCalendar={handleConnectCalendar}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            <ChatWindow messages={messages} isLoading={isLoading} />

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-dark-600">
              <div className="flex gap-2 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Find events, book tickets, check your calendar..."
                  className="flex-1 px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 bg-primary hover:bg-primary/80 disabled:bg-dark-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>

          {/* Tool Call Sidebar */}
          <ToolCallPanel toolCalls={activeToolCalls} isActive={isLoading} />
        </div>
      </div>
    </WalletGate>
  )
}
