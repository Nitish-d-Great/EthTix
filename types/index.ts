// ============================================
// Event Discovery Types
// ============================================

export interface ScrapedEvent {
  apiId: string;
  name: string;
  date: string;
  startAt: string;
  endAt: string;
  timezone: string;
  venue: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  price: number;
  isFree: boolean;
  soldOut: boolean;
  spotsRemaining: number | null;
  hosts: string[];
  coverUrl: string;
  lumaUrl: string;
  guestCount: number;
  genre: string;
  description?: string;
}

export interface EventMatch {
  event: ScrapedEvent;
  score: number;
  breakdown: {
    budget: number;
    genre: number;
    calendar: number;
    temporal: number;
    dayPreference: number;
    base: number;
  };
  calendarMatch: boolean;
  conflictDetails?: string;
}

// ============================================
// User Intent Types
// ============================================

export interface Attendee {
  name: string;
  email?: string;
}

export interface UserIntent {
  attendees: Attendee[];
  budget: number | null;
  preferredDays: string[];
  genres: string[];
  location: string;
  checkCalendar: boolean;
  notes?: string;
}

// ============================================
// Wallet Types
// ============================================

export interface WalletInfo {
  address: string;
  balance: string;
  chainId: number;
}

export interface WalletAction {
  type: 'contract_write' | 'sign_message';
  address?: string;
  functionName?: string;
  args?: unknown[];
  value?: string;
  message?: string;
}

// ============================================
// Ticket Types
// ============================================

export interface TicketInfo {
  tokenId: number;
  contractAddress: string;
  txHash: string;
  explorerUrl: string;
  qrData: string;
  eventName: string;
  venue: string;
  date: string;
  attendeeName: string;
  price: string;
  status: 'Active' | 'Redeemed' | 'Cancelled';
}

export interface BookingResult {
  success: boolean;
  tickets: TicketInfo[];
  contractAddress: string;
  tokenIds: number[];
  error?: string;
}

export interface PendingBooking {
  event: ScrapedEvent;
  attendees: Attendee[];
  requiresPayment: boolean;
}

// ============================================
// Calendar Types
// ============================================

export interface BusySlot {
  start: string;
  end: string;
}

export interface AttendeeAvailability {
  email: string;
  isFree: boolean;
  busySlots: BusySlot[];
}

// ============================================
// Chat & Agent Types
// ============================================

export interface ToolCallResult {
  tool: string;
  status: 'running' | 'completed' | 'error';
  summary: string;
  data?: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallResult[];
  tickets?: TicketInfo[];
  timestamp?: number;
}

export type ActionType =
  | 'greeting'
  | 'search_events'
  | 'book_ticket'
  | 'confirm_booking'
  | 'provide_email'
  | 'check_calendar'
  | 'discover_music'
  | 'cancel'
  | 'book_anyway'
  | 'general_question';

export interface AgentResponse {
  response: string;
  toolCalls: ToolCallResult[];
  tickets?: TicketInfo[];
  events?: ScrapedEvent[];
  walletAction?: WalletAction;
  pendingBooking?: PendingBooking;
  bookingResult?: BookingResult;
  needsEmails?: boolean;
}

// ============================================
// Audius Types
// ============================================

export interface AudiusTrack {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  playCount: number;
  favoriteCount: number;
  embedUrl: string;
  trackUrl: string;
}

export interface AudiusDiscoveryResult {
  tracks: AudiusTrack[];
  source: string;
}
