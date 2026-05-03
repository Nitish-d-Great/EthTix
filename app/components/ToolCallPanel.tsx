'use client'

import { ToolCallResult } from '@/types'

const toolIcons: Record<string, string> = {
  parse_intent: '🧠',
  discover_events: '🔍',
  check_calendars: '📅',
  match_events: '🎯',
  execute_booking: '⚡',
  create_calendar_event: '📅',
  send_email: '✉️',
}

const toolLabels: Record<string, string> = {
  parse_intent: 'Parsing Intent',
  discover_events: 'Discovering Events',
  check_calendars: 'Checking Calendars',
  match_events: 'Matching Events',
  execute_booking: 'Minting Tickets',
  create_calendar_event: 'Creating Calendar Event',
  send_email: 'Sending Email',
}

interface ToolCallPanelProps {
  toolCalls: ToolCallResult[]
  isActive: boolean
}

export default function ToolCallPanel({ toolCalls, isActive }: ToolCallPanelProps) {
  if (toolCalls.length === 0 && !isActive) return null

  return (
    <div className="w-72 bg-dark-800 border-l border-dark-600 p-4 overflow-y-auto">
      <div className="flex items-center gap-2 mb-4">
        {isActive && (
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        )}
        <h3 className="text-sm font-semibold text-white">
          {isActive ? 'Agent Working...' : 'Agent Actions'}
        </h3>
      </div>

      <div className="space-y-2">
        {toolCalls.map((call, index) => (
          <div key={index} className="flex items-start gap-2 p-2 bg-dark-700 rounded-lg">
            <span className="text-sm mt-0.5">{toolIcons[call.tool] || '⚙️'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-200 truncate">
                  {toolLabels[call.tool] || call.tool}
                </span>
                <span className="text-xs ml-1">
                  {call.status === 'running' && '⏳'}
                  {call.status === 'completed' && '✅'}
                  {call.status === 'error' && '❌'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{call.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
