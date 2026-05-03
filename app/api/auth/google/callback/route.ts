import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', req.url))
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', req.url))
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Get user email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const userInfo = await userInfoResponse.json()
    const email = userInfo.email || ''

    // Redirect to home with token in hash (client-side only)
    const redirectUrl = new URL('/', req.url)
    redirectUrl.hash = `calendar_token=${accessToken}&email=${encodeURIComponent(email)}`

    return NextResponse.redirect(redirectUrl.toString())
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/?error=oauth_failed', req.url))
  }
}
