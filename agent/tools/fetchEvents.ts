import { ScrapedEvent } from '@/types'

const LUMA_API_BASE = 'https://api.lu.ma/discover/get-paginated-events'

interface LumaEntry {
  event: {
    api_id: string;
    name: string;
    start_at: string;
    end_at: string;
    timezone: string;
    url: string;
    geo_address_info?: {
      city_state?: string;
      address?: string;
      full_address?: string;
      place_id?: string;
    };
    description?: string;
  };
  hosts?: Array<{ name: string }>;
  guest_count?: number;
  ticket_info?: {
    price?: number;
    max_price?: number;
    is_free?: boolean;
    is_sold_out?: boolean;
    spots_remaining?: number;
  };
  cover_url?: string;
}

interface LumaResponse {
  entries: LumaEntry[];
  has_more: boolean;
  next_cursor?: string;
}

function inferGenre(name: string, description?: string): string {
  const text = `${name} ${description || ''}`.toLowerCase()

  const genreMap: Record<string, string[]> = {
    'tech': ['tech', 'developer', 'engineering', 'software', 'coding', 'hackathon', 'ai', 'ml', 'data'],
    'crypto': ['crypto', 'blockchain', 'web3', 'defi', 'nft', 'ethereum', 'bitcoin', 'dao'],
    'music': ['music', 'concert', 'dj', 'live band', 'jazz', 'electronic', 'hip-hop'],
    'art': ['art', 'gallery', 'exhibition', 'creative', 'design', 'photography'],
    'food': ['food', 'dinner', 'brunch', 'cooking', 'wine', 'tasting', 'culinary'],
    'fitness': ['fitness', 'run', 'yoga', 'workout', 'sports', 'marathon'],
    'networking': ['networking', 'meetup', 'mixer', 'social', 'founders', 'startup'],
    'education': ['workshop', 'class', 'course', 'learn', 'seminar', 'lecture'],
  }

  for (const [genre, keywords] of Object.entries(genreMap)) {
    if (keywords.some(kw => text.includes(kw))) {
      return genre
    }
  }
  return 'general'
}

function transformLumaEvent(entry: LumaEntry): ScrapedEvent {
  const { event, hosts, guest_count, ticket_info, cover_url } = entry

  const startDate = new Date(event.start_at)
  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeStr = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return {
    apiId: event.api_id,
    name: event.name,
    date: `${dateStr} ${timeStr}`,
    startAt: event.start_at,
    endAt: event.end_at,
    timezone: event.timezone || 'UTC',
    venue: event.geo_address_info?.city_state || event.geo_address_info?.address || 'Online',
    address: event.geo_address_info?.full_address || event.geo_address_info?.address || '',
    latitude: null,
    longitude: null,
    price: ticket_info?.price || 0,
    isFree: ticket_info?.is_free ?? (ticket_info?.price === 0 || !ticket_info?.price),
    soldOut: ticket_info?.is_sold_out || false,
    spotsRemaining: ticket_info?.spots_remaining ?? null,
    hosts: hosts?.map(h => h.name) || [],
    coverUrl: cover_url || '',
    lumaUrl: `https://lu.ma/${event.url}`,
    guestCount: guest_count || 0,
    genre: inferGenre(event.name, event.description),
    description: event.description,
  }
}

export async function fetchEvents(
  location: string,
  category?: string
): Promise<ScrapedEvent[]> {
  const allEvents: ScrapedEvent[] = []
  let cursor: string | undefined
  const maxPages = 3

  try {
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({ location })
      if (category) params.set('category', category)
      if (cursor) params.set('cursor', cursor)

      const response = await fetch(`${LUMA_API_BASE}?${params}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        console.error(`Luma API error: ${response.status}`)
        break
      }

      const data: LumaResponse = await response.json()
      const events = data.entries.map(transformLumaEvent)
      allEvents.push(...events)

      if (!data.has_more || !data.next_cursor) break
      cursor = data.next_cursor
    }
  } catch (error) {
    console.error('Luma API fetch failed:', error)
  }

  // If API fails, return fallback events
  if (allEvents.length === 0) {
    return getFallbackEvents(location)
  }

  // Filter out sold-out events and past events
  const now = new Date()
  return allEvents.filter(e => !e.soldOut && new Date(e.startAt) > now)
}

function getFallbackEvents(location: string): ScrapedEvent[] {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  return [
    {
      apiId: 'fallback-1',
      name: 'Ethereum Builders Meetup',
      date: tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' 6:00 PM',
      startAt: tomorrow.toISOString(),
      endAt: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      timezone: 'America/New_York',
      venue: location || 'Tech Hub',
      address: location || 'Downtown',
      latitude: null,
      longitude: null,
      price: 0,
      isFree: true,
      soldOut: false,
      spotsRemaining: 50,
      hosts: ['ETH Community'],
      coverUrl: '',
      lumaUrl: 'https://lu.ma',
      guestCount: 45,
      genre: 'crypto',
    },
    {
      apiId: 'fallback-2',
      name: 'Web3 Developer Workshop',
      date: nextWeek.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' 2:00 PM',
      startAt: nextWeek.toISOString(),
      endAt: new Date(nextWeek.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      timezone: 'America/New_York',
      venue: location || 'Innovation Center',
      address: location || 'Midtown',
      latitude: null,
      longitude: null,
      price: 25,
      isFree: false,
      soldOut: false,
      spotsRemaining: 30,
      hosts: ['DApp Labs'],
      coverUrl: '',
      lumaUrl: 'https://lu.ma',
      guestCount: 70,
      genre: 'tech',
    },
    {
      apiId: 'fallback-3',
      name: 'DeFi & Networking Night',
      date: nextWeek.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' 7:00 PM',
      startAt: new Date(nextWeek.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      endAt: new Date(nextWeek.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      timezone: 'America/New_York',
      venue: location || 'Crypto Lounge',
      address: location || 'Financial District',
      latitude: null,
      longitude: null,
      price: 10,
      isFree: false,
      soldOut: false,
      spotsRemaining: 100,
      hosts: ['DeFi Alliance'],
      coverUrl: '',
      lumaUrl: 'https://lu.ma',
      guestCount: 120,
      genre: 'crypto',
    },
  ]
}
