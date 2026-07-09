import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username, followers, posts_last_30d, avg_likes, avg_views } = await req.json()

  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Instagram username kiritilmadi' }, { status: 400 })
  }

  const toNumber = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('connected_accounts')
    .upsert(
      {
        user_id: user.id,
        platform: 'instagram',
        account_name: username.trim().replace(/^@/, ''),
        data: {
          followers: toNumber(followers),
          posts_last_30d: toNumber(posts_last_30d),
          avg_likes: toNumber(avg_likes),
          avg_views: toNumber(avg_views),
        },
      },
      { onConflict: 'user_id,platform' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
