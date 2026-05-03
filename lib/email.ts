import { TicketInfo } from '@/types'

interface EmailPayload {
  to: string
  bookingResult: {
    tickets: TicketInfo[]
    contractAddress: string
  }
  userWalletAddress: string
}

export async function sendBookingConfirmation(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured')
    return false
  }

  const { to, bookingResult, userWalletAddress } = payload
  const { tickets, contractAddress } = bookingResult
  const firstTicket = tickets[0]

  if (!firstTicket) return false

  const html = buildEmailHtml(tickets, contractAddress, userWalletAddress)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'EthTix <onboarding@resend.dev>',
        to: [to],
        subject: `Booking Confirmed: ${firstTicket.eventName}`,
        html,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Resend API error:', response.status, errorBody)
    }

    return response.ok
  } catch (error) {
    console.error('Email send failed:', error)
    return false
  }
}

function buildEmailHtml(tickets: TicketInfo[], contractAddress: string, walletAddress: string): string {
  const ticketRows = tickets.map(ticket => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #2e2e3a;">
        <strong style="color: #f1f1f3;">${ticket.attendeeName}</strong><br>
        <span style="color: #9ca3af; font-size: 12px;">Token #${ticket.tokenId}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #2e2e3a;">
        <a href="${ticket.explorerUrl}" style="color: #5B5BD6; text-decoration: none; font-size: 12px; font-family: monospace;">
          ${ticket.txHash.slice(0, 16)}...
        </a>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #2e2e3a;">
        <span style="color: #06D6A0; font-size: 12px;">${ticket.status}</span>
      </td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #f1f1f3; margin: 0; font-size: 24px;">🎫 EthTix</h1>
          <p style="color: #9ca3af; margin: 8px 0 0; font-size: 14px;">Booking Confirmation</p>
        </div>

        <!-- Event Details -->
        <div style="background-color: #12121a; border: 1px solid #2e2e3a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #f1f1f3; margin: 0 0 16px; font-size: 18px;">${tickets[0].eventName}</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">📍 Venue</td>
              <td style="padding: 8px 0; color: #f1f1f3; font-size: 13px;">${tickets[0].venue}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">📅 Date</td>
              <td style="padding: 8px 0; color: #f1f1f3; font-size: 13px;">${tickets[0].date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">💰 Price</td>
              <td style="padding: 8px 0; color: #f1f1f3; font-size: 13px;">${tickets[0].price}</td>
            </tr>
          </table>
        </div>

        <!-- Blockchain Details -->
        <div style="background-color: #12121a; border: 1px solid #2e2e3a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #f1f1f3; margin: 0 0 16px; font-size: 14px;">⛓️ On-Chain Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 6px 0; color: #9ca3af;">Network</td>
              <td style="padding: 6px 0; color: #f1f1f3;">Ethereum Sepolia</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #9ca3af;">Contract</td>
              <td style="padding: 6px 0;">
                <a href="https://sepolia.etherscan.io/address/${contractAddress}" style="color: #5B5BD6; text-decoration: none; font-family: monospace; font-size: 11px;">
                  ${contractAddress.slice(0, 10)}...${contractAddress.slice(-8)}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #9ca3af;">Your Wallet</td>
              <td style="padding: 6px 0;">
                <a href="https://sepolia.etherscan.io/address/${walletAddress}" style="color: #5B5BD6; text-decoration: none; font-family: monospace; font-size: 11px;">
                  ${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}
                </a>
              </td>
            </tr>
          </table>
        </div>

        <!-- Tickets Table -->
        <div style="background-color: #12121a; border: 1px solid #2e2e3a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #f1f1f3; margin: 0 0 16px; font-size: 14px;">🎟️ Tickets</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 1px solid #2e2e3a;">
                <th style="padding: 8px 12px; text-align: left; color: #9ca3af; font-weight: 500;">Attendee</th>
                <th style="padding: 8px 12px; text-align: left; color: #9ca3af; font-weight: 500;">Transaction</th>
                <th style="padding: 8px 12px; text-align: left; color: #9ca3af; font-weight: 500;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${ticketRows}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #2e2e3a;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Tickets minted as ERC-721 NFTs on Ethereum Sepolia (testnet)
          </p>
          <p style="color: #6b7280; font-size: 11px; margin: 8px 0 0;">
            Powered by EthTix — AI-Powered Event Ticketing
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}
