import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  fetchRecentMediaStats,
  InstagramApiError,
} from '@/lib/instagram'
import { IG_OAUTH_STATE_COOKIE } from '../connect/route'

export async function GET(req: NextRequest) {
  const redirectTo = (params: Record<string, string>) => {
    const url = new URL('/akkauntlar', req.url)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    return NextResponse.redirect(url)
  }

  const user = await getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const storedState = req.cookies.get(IG_OAUTH_STATE_COOKIE)?.value

  if (!code || !state || !storedState || state !== storedState) {
    const res = redirectTo({ instagram: 'error', reason: 'Instagram autentifikatsiya sessiyasi eskirgan, qayta urinib ko\'ring' })
    res.cookies.delete(IG_OAUTH_STATE_COOKIE)
    return res
  }

  try {
    const shortLivedToken = await exchangeCodeForToken(code)
    const { accessToken, expiresAt } = await exchangeForLongLivedToken(shortLivedToken)
    const profile = await fetchInstagramProfile(accessToken)
    const mediaStats = await fetchRecentMediaStats(accessToken)

    const db = createServerClient()
    const { error } = await db
      .from('connected_accounts')
      .upsert(
        {
          user_id: user.id,
          platform: 'instagram',
          account_name: profile.username,
          access_token: accessToken,
          token_expires_at: expiresAt.toISOString(),
          data: {
            id: profile.id,
            followers: profile.followers,
            posts_last_30d: mediaStats.postsLast30d,
            avg_likes: mediaStats.avgLikes,
            avg_views: mediaStats.avgViews,
            account_type: profile.accountType,
            media_count: profile.mediaCount,
          },
        },
        { onConflict: 'user_id,platform' },
      )

    if (error) throw new InstagramApiError(error.message)

    const res = redirectTo({ instagram: 'connected' })
    res.cookies.delete(IG_OAUTH_STATE_COOKIE)
    return res
  } catch (err) {
    const message = err instanceof InstagramApiError ? err.message : 'Instagram bilan ulanishda xatolik yuz berdi'
    const res = redirectTo({ instagram: 'error', reason: message })
    res.cookies.delete(IG_OAUTH_STATE_COOKIE)
    return res
  }
}
