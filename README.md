# EthTix — AI-Powered Event Ticketing on Ethereum

EthTix is a full-stack decentralized application that reimagines event ticketing by combining a conversational AI agent with on-chain ERC-721 NFT tickets on Ethereum. Users interact through a natural language chat interface to discover real-world events, book tickets minted as NFTs on the Sepolia testnet, sync with Google Calendar for conflict-free scheduling, and receive styled email confirmations — all in a single, seamless flow.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Smart Contract](#smart-contract)
- [AI Agent Pipeline](#ai-agent-pipeline)
- [User Flow](#user-flow)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Deployment](#deployment)

---

## Overview

EthTix bridges the gap between AI-driven user experience and decentralized infrastructure. Instead of browsing through event listings and filling out forms, users simply tell the AI agent what they're looking for — a city, a genre, a budget, a date range — and the agent handles the entire pipeline: discovering events from the Luma API, scoring and ranking them against user preferences, checking Google Calendar availability for all attendees, orchestrating on-chain NFT minting via MetaMask, creating calendar invitations, and sending confirmation emails with Etherscan transaction links.

Every ticket is a fully on-chain ERC-721 NFT managed by a custom `TicketManager` smart contract. Tickets carry rich metadata (event name, venue, date, attendee name, price, status) and can be verified and redeemed at the venue through a dedicated verification page with QR code scanning.

---

## Key Features

### Conversational AI Agent
- Natural language event discovery powered by **Groq's Llama 3.3 70B** model
- Intent extraction via LLM — parses attendees, budget, genres, location, and date preferences from free-form text
- Tool-calling architecture with real-time tool-call tracking sidebar showing each step the agent takes
- Context-aware conversation flow with an 8-step mandatory booking pipeline

### On-Chain NFT Ticketing
- Tickets minted as **ERC-721 NFTs** on **Ethereum Sepolia** testnet
- Custom `TicketManager.sol` smart contract built with **OpenZeppelin** (ERC721URIStorage, Ownable, ReentrancyGuard)
- Support for both **paid tickets** (user signs transaction via MetaMask) and **free tickets** (server-side minting using a platform wallet)
- On-chain ticket verification and redemption (check-in) via `verifyTicket()` and `redeemTicket()`
- Automatic excess ETH refund if user overpays the platform fee
- Authorized redeemer system for event organizers

### Real Event Discovery
- Live event data fetched from the **Luma API** with paginated geo-location based search
- LLM-powered geocoding to resolve city names to coordinates
- Automatic genre inference (crypto, tech, music, art, food, fitness, networking, education)
- Fallback mock events ensure the demo never breaks if the API is down

### Smart Event Matching & Scoring
- Multi-factor scoring algorithm weighing:
  - **Budget fit** — hard exclude if over budget, bonus for free events
  - **Genre relevance** — keyword matching against event name and category
  - **Calendar availability** — +30 for conflict-free, -20 for conflicts
  - **Temporal proximity** — prefer sooner events (within 14 days)
  - **Day preference** — match against user's preferred days/timeframes
- Natural date range detection (today, tomorrow, this weekend, next week, next N days)
- Returns top 5 ranked matches with conflict indicators

### Google Calendar Integration
- Full **OAuth 2.0** flow (consent → callback → token exchange)
- **FreeBusy API** checks attendee availability across all matched events before presenting options
- Automatic **Google Calendar event creation** with venue, description, and attendee invitations after booking
- Calendar conflict warnings with "book anyway" confirmation flow

### Email Confirmations
- Styled dark-themed HTML emails sent via **Resend** API
- Includes event details, on-chain information (network, contract address, wallet address)
- Per-ticket transaction hashes with clickable **Etherscan** links
- Ticket status indicators (Active/Redeemed/Cancelled)

### Ticket Verification & Check-In
- Dedicated `/verify` page for event organizers
- Verify tickets by **Token ID** or by pasting **QR code JSON data**
- On-chain verification reads ticket status directly from the smart contract
- One-click "Check In" button calls `redeemTicket()` on-chain to mark the ticket as Redeemed
- Color-coded status badges (green = Active, yellow = Redeemed, red = Cancelled)

### Wallet-Gated Onboarding
- Two-step onboarding: connect MetaMask wallet → pay 0.0001 ETH platform access fee
- Step indicator UI with progress tracking
- Transaction confirmation with Etherscan link
- Sepolia testnet — no real ETH required

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  Next.js 15 + React 19 + Tailwind CSS           │
│  ┌──────────┐ ┌───────────┐ ┌────────────────┐  │
│  │WalletGate│ │ChatWindow │ │ToolCallPanel   │  │
│  │(Onboard) │ │(Messages) │ │(Agent Actions) │  │
│  └──────────┘ └───────────┘ └────────────────┘  │
│  ┌──────────┐ ┌───────────┐                      │
│  │ Header   │ │TicketCard │                      │
│  │(Nav/Cal) │ │(NFT + QR) │                      │
│  └──────────┘ └───────────┘                      │
│         │           │                            │
│    Wagmi/Viem  React Markdown                    │
│    (Web3)      (Chat Render)                     │
└────────┬────────────┬────────────────────────────┘
         │            │
         ▼            ▼
┌─────────────────────────────────────────────────┐
│               API Routes (Next.js)               │
│  /api/agent          — Main LLM message handler  │
│  /api/agent/execute  — Booking execution         │
│  /api/verify         — On-chain ticket verify    │
│  /api/ticket-metadata— NFT metadata endpoint     │
│  /api/auth/google    — OAuth init + callback     │
│  /api/calendar       — FreeBusy availability     │
└────────┬────────────┬───────────┬────────────────┘
         │            │           │
         ▼            ▼           ▼
┌──────────────┐ ┌──────────┐ ┌────────────────────┐
│  AI Agent    │ │ Ethereum │ │ External Services  │
│  ┌─────────┐ │ │ Sepolia  │ │                    │
│  │ Groq    │ │ │          │ │  Luma API (Events) │
│  │Llama 3.3│ │ │TicketMgr │ │  Google Calendar   │
│  │  70B    │ │ │(ERC-721) │ │  Resend (Email)    │
│  └─────────┘ │ │          │ │  Etherscan         │
│  Tools:      │ └──────────┘ └────────────────────┘
│  - fetchEvt  │
│  - matchEvt  │
│  - checkCal  │
│  - execBook  │
└──────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 15.5 | React framework with App Router, API routes, SSR |
| **React** | 19.2 | UI library with hooks-based state management |
| **TypeScript** | 5.x | Type safety across the entire codebase |
| **Tailwind CSS** | 3.4 | Utility-first styling with custom dark theme |
| **Wagmi** | 2.19 | React hooks for Ethereum wallet interaction |
| **Viem** | 2.48 | TypeScript Ethereum client (transactions, contract calls, ABI encoding) |
| **TanStack React Query** | 5.100 | Async state management for wallet and contract data |
| **React Markdown** | 10.1 | Renders agent responses with rich markdown formatting |
| **React QR Code** | 2.0 | Generates QR codes embedded in NFT ticket cards |
| **UUID** | 14.0 | Unique message and session identifiers |

### Backend & AI
| Technology | Version | Purpose |
|---|---|---|
| **Next.js API Routes** | 15.5 | Serverless backend endpoints |
| **Groq SDK** | 1.1 | LLM inference provider |
| **Llama 3.3 70B** | — | Large language model for intent extraction and response generation |
| **Resend** | 6.12 | Transactional email API for booking confirmations |
| **Google APIs (googleapis)** | 171.4 | OAuth 2.0, Calendar FreeBusy, Calendar Event creation |

### Smart Contracts & Blockchain
| Technology | Version | Purpose |
|---|---|---|
| **Solidity** | ^0.8.27 | Smart contract language |
| **OpenZeppelin Contracts** | 5.6 | ERC-721URIStorage, Ownable, ReentrancyGuard |
| **Hardhat** | 3.4 | Solidity compilation, testing, and deployment |
| **Ethers.js** | 6.16 | Ethereum library (used in deployment scripts) |
| **Viem** | 2.48 | Server-side contract interaction (minting, verification) |
| **Ethereum Sepolia** | — | Testnet for NFT deployment (chainId: 11155111) |

### External Services
| Service | Purpose |
|---|---|
| **Luma API** | Real event discovery with geo-location search |
| **Google Calendar API** | Attendee availability checking and event creation |
| **Resend** | Email delivery for booking confirmations |
| **Etherscan (Sepolia)** | Block explorer for transaction and token verification |

---

## Smart Contract

**Contract:** `TicketManager.sol`
**Standard:** ERC-721 (NFT) with URI Storage
**Network:** Ethereum Sepolia Testnet

### Contract Features

```solidity
// Ticket data stored on-chain for each NFT
struct Ticket {
    string eventId;
    string eventName;
    string venue;
    string date;
    string attendeeName;
    uint256 pricePaid;
    TicketStatus status;      // Active | Redeemed | Cancelled
    uint256 mintTimestamp;
}
```

| Function | Access | Description |
|---|---|---|
| `purchaseTicket()` | Public (payable) | Mints a paid ticket NFT, forwards platform fee, refunds excess ETH |
| `mintFreeTicket()` | Owner only | Mints a free ticket to any address (server-side for free events) |
| `redeemTicket()` | Owner/Holder/Authorized | Marks ticket as Redeemed (event check-in) |
| `verifyTicket()` | Public (view) | Returns ticket validity, event details, and status |
| `getTicketInfo()` | Public (view) | Returns full ticket struct |
| `setAuthorizedRedeemer()` | Owner only | Designates addresses that can redeem tickets |
| `setPlatformFee()` | Owner only | Updates the platform fee amount |
| `setPlatformWallet()` | Owner only | Updates the fee recipient address |
| `withdraw()` | Owner only | Withdraws accumulated contract balance |

### Security
- **ReentrancyGuard** on all payable functions to prevent reentrancy attacks
- **Ownable** access control for admin functions
- Automatic excess ETH refund with failure checks
- Token existence validation on all ticket operations

---

## AI Agent Pipeline

The agent follows a mandatory **8-step booking pipeline** for every ticket purchase:

```
User Message
    │
    ▼
1. PARSE INTENT ─────────── Extract attendees, budget, genres, location, dates via LLM
    │
    ▼
2. DISCOVER EVENTS ──────── Fetch from Luma API (geo-search) or fallback events
    │
    ▼
3. MATCH & FILTER ───────── Score events by budget + genre + availability + temporal
    │
    ▼
4. CHECK CALENDAR ───────── Google Calendar FreeBusy API for all attendee emails
    │
    ▼
5. PRESENT OPTIONS ──────── Show top 5 matches with ✅/⚠️ conflict indicators
    │
    ▼
6. CONFIRM & PAYMENT ────── User selects event, wallet action prepared
    │
    ▼
7. MINT NFT TICKETS ─────── ERC-721 minting (client-side for paid, server-side for free)
    │
    ▼
8. CALENDAR + EMAIL ─────── Create calendar event, send confirmation via Resend
```

### Agent Tools
| Tool | Description |
|---|---|
| `discover_events` | Fetches real events from Luma API based on geo-coordinates |
| `match_events` | Scores and ranks events using multi-factor algorithm |
| `check_calendars` | Verifies attendee availability via Google Calendar FreeBusy |
| `execute_booking` | Orchestrates NFT minting, calendar creation, and email sending |
| `parse_intent` | LLM-based extraction of user preferences from natural language |

### Intent Classification
The agent uses regex-based intent classification with context-awareness:
- Detects greetings, search requests, booking confirmations, calendar checks, email requests, cancellations
- Context-aware: recognizes "yes" as a booking confirmation when awaiting selection, or "book anyway" when a calendar conflict was flagged
- Falls back to LLM for general questions

---

## User Flow

### Onboarding
1. **Connect Wallet** — User connects MetaMask on Sepolia testnet
2. **Pay Platform Fee** — One-time 0.0001 ETH access fee (covers gas for free ticket minting)
3. **Access Granted** — Main chat interface loads

### Booking Flow
1. **Natural Language Input** — "Find crypto events in San Francisco this weekend"
2. **Agent Processes** — Parses intent → fetches events → scores matches → checks calendar
3. **Events Presented** — Top 5 matches with venue, date, price, host, attendee count, calendar status
4. **User Selects** — "Book the first one" or "Book #2 for Akash and Aman"
5. **Calendar Conflict** — If conflict detected, agent asks "book anyway?" before proceeding
6. **Wallet Action**:
   - **Free events**: Sign message in MetaMask → server mints NFT via `mintFreeTicket()`
   - **Paid events**: Confirm transaction in MetaMask → `purchaseTicket()` called with platform fee
7. **Confirmation** — Ticket card with QR code, Token ID, Etherscan link displayed in chat
8. **Post-Booking** — Google Calendar event created, confirmation email sent via Resend

### Verification & Check-In
1. Navigate to `/verify`
2. Enter Token ID or paste QR code JSON data
3. View ticket details and validity status
4. Click "Check In" to call `redeemTicket()` on-chain

---

## Project Structure

```
ethtix/
├── agent/
│   ├── index.ts                 # Core agent orchestration and state management
│   ├── prompts/
│   │   └── system.ts            # System prompt with booking pipeline rules
│   └── tools/
│       ├── fetchEvents.ts       # Luma API integration + fallback events
│       ├── matchEvents.ts       # Multi-factor scoring algorithm
│       ├── checkCalendar.ts     # Google Calendar FreeBusy + event creation
│       └── executeBooking.ts    # Server-side booking execution
├── app/
│   ├── page.tsx                 # Main chat interface (client component)
│   ├── layout.tsx               # Root layout with providers
│   ├── providers.tsx            # Wagmi + React Query providers
│   ├── globals.css              # Tailwind base + custom dark theme
│   ├── verify/
│   │   └── page.tsx             # Ticket verification & check-in page
│   ├── components/
│   │   ├── ChatWindow.tsx       # Message display with markdown rendering
│   │   ├── Header.tsx           # Navigation, wallet status, calendar connect
│   │   ├── TicketCard.tsx       # NFT ticket display with QR code
│   │   ├── ToolCallPanel.tsx    # Real-time agent action tracking sidebar
│   │   └── WalletGate.tsx       # Two-step onboarding (connect + pay)
│   └── api/
│       ├── agent/
│       │   └── route.ts         # POST handler for chat messages
│       ├── verify/
│       │   └── route.ts         # POST handler for ticket verification
│       ├── ticket-metadata/
│       │   └── route.ts         # NFT metadata endpoint (tokenURI)
│       └── auth/
│           └── google/          # OAuth init + callback routes
├── contracts/
│   └── TicketManager.sol        # ERC-721 NFT ticketing smart contract
├── lib/
│   ├── ethereum.ts              # Viem clients, minting, verification helpers
│   ├── email.ts                 # Resend email with HTML template
│   └── abi/
│       └── TicketManager.ts     # Contract ABI for frontend interaction
├── scripts/
│   └── deploy.ts                # Hardhat deployment script
├── types/
│   └── index.ts                 # TypeScript type definitions
├── wagmi.config.ts              # Wagmi chain and connector configuration
├── hardhat.config.ts            # Hardhat network and Solidity settings
├── tailwind.config.ts           # Tailwind theme customization
├── next.config.mjs              # Next.js configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies and scripts
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# AI / LLM
GROQ_API_KEY=                        # Groq API key for Llama 3.3 70B

# Google OAuth (Calendar Integration)
GOOGLE_CLIENT_ID=                    # Google Cloud OAuth client ID
GOOGLE_CLIENT_SECRET=                # Google Cloud OAuth client secret
GOOGLE_REDIRECT_URI=                 # OAuth callback URL (e.g., http://localhost:3000/api/auth/google/callback)

# Ethereum / Smart Contract
NEXT_PUBLIC_CONTRACT_ADDRESS=        # Deployed TicketManager contract address
NEXT_PUBLIC_RPC_URL=                 # Sepolia RPC endpoint (e.g., https://ethereum-sepolia-rpc.publicnode.com)
NEXT_PUBLIC_PLATFORM_WALLET=         # Wallet address to receive platform fees
PRIVATE_KEY=                         # Server wallet private key (for free ticket minting)

# Email
RESEND_API_KEY=                      # Resend API key for sending confirmation emails

# Optional
ETHERSCAN_API_KEY=                   # Etherscan API key for contract verification
NEXT_PUBLIC_VERCEL_URL=              # Deployment URL (for NFT metadata URIs)
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MetaMask browser extension
- Sepolia testnet ETH ([Sepolia Faucet](https://sepoliafaucet.com))

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd ethtix

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your API keys and contract address
```

### Deploy the Smart Contract

```bash
# Compile the contract
npx hardhat compile

# Deploy to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia
```

Copy the deployed contract address into `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env.local`.

### Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — connect MetaMask to Sepolia, pay the access fee, and start chatting with the AI agent.

---

## Deployment

### Vercel (Recommended)

```bash
npm run build
```

Deploy to [Vercel](https://vercel.com) and configure all environment variables in the Vercel dashboard. Set `NEXT_PUBLIC_VERCEL_URL` to your deployment domain for NFT metadata URIs.

### Manual

```bash
npm run build
npm start
```

---

Built for [ETHGlobal](https://ethglobal.com) — AI meets Ethereum, one ticket at a time.
