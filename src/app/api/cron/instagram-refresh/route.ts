import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import {
  refreshLongLivedToken,
  fetchInstagramProfile,
  fetchRecentMediaStats,
  InstagramApiError,
} from '@/lib/instagram'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  const soon = new Date(Date.now() + 5 * DAY_MS).toISOString()

  const { data: accounts, error } = await db
    .from('connected_accounts')
    .select('id, access_token, token_expires_at')
    .eq('platform', 'instagram')
    .not('access_token', 'is', null)
    .lte('token_expires_at', soon)

  if (error) {
    console.error('[cron/instagram-refresh] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let refreshed = 0
  let failed = 0

  for (const account of accounts ?? []) {
    try {
      const { accessToken, expiresAt } = await refreshLongLivedToken(account.access_token as string)
      const profile = await fetchInstagramProfile(accessToken)
      const mediaStats = await fetchRecentMediaStats(accessToken)

      await db
        .from('connected_accounts')
        .update({
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
        })
        .eq('id', account.id)

      refreshed++
    } catch (err) {
      const message = err instanceof InstagramApiError ? err.message : err instanceof Error ? err.message : String(err)
      console.error('[cron/instagram-refresh] refresh error for account', account.id, message)
      failed++
    }
  }

  return NextResponse.json({ processed: accounts?.length ?? 0, refreshed, failed })
}
