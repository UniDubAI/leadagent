import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUser } from '@/lib/supabase/server'
import { getInstagramAuthUrl, InstagramApiError } from '@/lib/instagram'

export const IG_OAUTH_STATE_COOKIE = 'ig_oauth_state'

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const state = randomUUID()
    const authUrl = getInstagramAuthUrl(state)

    const res = NextResponse.redirect(authUrl)
    res.cookies.set(IG_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
    return res
  } catch (err) {
    const message = err instanceof InstagramApiError ? err.message : 'Instagram ulanishni boshlashning imkoni bo\'lmadi'
    return NextResponse.redirect(new URL(`/akkauntlar?instagram=error&reason=${encodeURIComponent(message)}`, req.url))
  }
}
