'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChatMessage } from '@/types'
import TicketCard from './TicketCard'

interface ChatWindowProps {
  messages: ChatMessage[]
  isLoading: boolean
}

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-primary/20 border border-primary/30 text-gray-100'
                : 'bg-dark-700 border border-dark-600 text-gray-200'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <span>🎫</span> EthTix
              </div>
            )}

            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {children}
                    </a>
                  ),
                  code: ({ children }) => (
                    <code className="bg-dark-900 px-1.5 py-0.5 rounded text-xs font-mono text-gray-300">
                      {children}
                    </code>
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>

            {/* Tool Calls Summary */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="mt-2 pt-2 border-t border-dark-600 space-y-1">
                {msg.toolCalls.map((call, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span>
                      {call.status === 'completed' ? '✅' : call.status === 'error' ? '❌' : '⏳'}
                    </span>
                    <span>{call.summary}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Ticket Cards */}
            {msg.tickets && msg.tickets.length > 0 && (
              <div className="mt-3 grid gap-3">
                {msg.tickets.map((ticket, i) => (
                  <TicketCard key={i} ticket={ticket} />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-dark-700 border border-dark-600 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
