const GRAPH_VERSION = 'v21.0'
const DAY_MS = 24 * 60 * 60 * 1000

export class InstagramApiError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new InstagramApiError(`${name} sozlanmagan`)
  return value
}

export function getInstagramAuthUrl(state: string): string {
  const clientId = requireEnv('INSTAGRAM_APP_ID')
  const redirectUri = requireEnv('INSTAGRAM_REDIRECT_URI')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_manage_insights',
    state,
  })

  return `https://www.instagram.com/oauth/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = requireEnv('INSTAGRAM_APP_ID')
  const clientSecret = requireEnv('INSTAGRAM_APP_SECRET')
  const redirectUri = requireEnv('INSTAGRAM_REDIRECT_URI')

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })

  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body,
  })
  const json = await res.json()

  if (!res.ok || !json.access_token) {
    throw new InstagramApiError(
      `Instagram token olishning imkoni bo'lmadi: ${json.error_message ?? res.statusText}`,
    )
  }

  return json.access_token as string
}

export interface InstagramTokenResult {
  accessToken: string
  expiresAt: Date
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<InstagramTokenResult> {
  const clientSecret = requireEnv('INSTAGRAM_APP_SECRET')

  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: shortLivedToken,
  })

  const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`)
  const json = await res.json()

  if (!res.ok || !json.access_token) {
    throw new InstagramApiError(
      `Instagram uzoq muddatli token olishning imkoni bo'lmadi: ${json.error?.message ?? res.statusText}`,
    )
  }

  return {
    accessToken: json.access_token as string,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 5184000) * 1000),
  }
}

export async function refreshLongLivedToken(token: string): Promise<InstagramTokenResult> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: token,
  })

  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`)
  const json = await res.json()

  if (!res.ok || !json.access_token) {
    throw new InstagramApiError(
      `Instagram tokenni yangilashning imkoni bo'lmadi: ${json.error?.message ?? res.statusText}`,
    )
  }

  return {
    accessToken: json.access_token as string,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 5184000) * 1000),
  }
}

export interface InstagramProfile {
  id: string
  username: string
  accountType: string | null
  mediaCount: number
  followers: number
}

export async function fetchInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const params = new URLSearchParams({
    fields: 'id,username,account_type,media_count,followers_count',
    access_token: accessToken,
  })

  const res = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/me?${params.toString()}`)
  const json = await res.json()

  if (!res.ok || !json.id) {
    throw new InstagramApiError(
      `Instagram profilini olishning imkoni bo'lmadi: ${json.error?.message ?? res.statusText}`,
    )
  }

  return {
    id: json.id as string,
    username: json.username as string,
    accountType: json.account_type ?? null,
    mediaCount: json.media_count ?? 0,
    followers: json.followers_count ?? 0,
  }
}

export interface InstagramMediaStats {
  postsLast30d: number
  avgLikes: number
  avgViews: number
}

export async function fetchRecentMediaStats(accessToken: string): Promise<InstagramMediaStats> {
  const params = new URLSearchParams({
    fields: 'id,timestamp,like_count,comments_count,media_type,media_product_type',
    access_token: accessToken,
    limit: '50',
  })

  const res = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/me/media?${params.toString()}`)
  const json = await res.json()

  if (!res.ok) {
    throw new InstagramApiError(
      `Instagram postlarini olishning imkoni bo'lmadi: ${json.error?.message ?? res.statusText}`,
    )
  }

  const items: Array<{
    id: string
    timestamp: string
    like_count?: number
    comments_count?: number
    media_type?: string
    media_product_type?: string
  }> = json.data ?? []

  const thirtyDaysAgo = Date.now() - 30 * DAY_MS
  const recent = items.filter((item) => new Date(item.timestamp).getTime() >= thirtyDaysAgo)

  const avgLikes = recent.length
    ? Math.round(recent.reduce((sum, item) => sum + (item.like_count ?? 0), 0) / recent.length)
    : 0

  // Reels-only view estimate: like/comment counts are on the media object directly,
  // but view counts need a per-media insights call — best-effort, falls back to 0.
  const reels = recent.filter((item) => item.media_product_type === 'REELS')
  let avgViews = 0
  if (reels.length) {
    let totalViews = 0
    let counted = 0
    for (const reel of reels) {
      try {
        const insightsParams = new URLSearchParams({ metric: 'plays', access_token: accessToken })
        const insightsRes = await fetch(
          `https://graph.instagram.com/${GRAPH_VERSION}/${reel.id}/insights?${insightsParams.toString()}`,
        )
        const insightsJson = await insightsRes.json()
        const plays = insightsJson?.data?.[0]?.values?.[0]?.value
        if (typeof plays === 'number') {
          totalViews += plays
          counted++
        }
      } catch {
        // best-effort — skip this reel's view count
      }
    }
    avgViews = counted ? Math.round(totalViews / counted) : 0
  }

  return {
    postsLast30d: recent.length,
    avgLikes,
    avgViews,
  }
}

export async function revokeInstagramAccess(accessToken: string, igUserId: string): Promise<void> {
  try {
    await fetch(
      `https://graph.instagram.com/${GRAPH_VERSION}/${igUserId}/permissions?access_token=${encodeURIComponent(accessToken)}`,
      { method: 'DELETE' },
    )
  } catch (err) {
    console.error('[instagram] revoke error:', err instanceof Error ? err.message : err)
  }
}
