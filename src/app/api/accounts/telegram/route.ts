import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import { getTelegramChannelStats, TelegramChannelError } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username } = await req.json()
  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Kanal username kiritilmadi' }, { status: 400 })
  }

  try {
    const stats = await getTelegramChannelStats(username)

    const db = createServerClient()
    const { data, error } = await db
      .from('connected_accounts')
      .upsert(
        {
          user_id: user.id,
          platform: 'telegram',
          account_name: stats.username,
          data: {
            title: stats.title,
            description: stats.description,
            members_count: stats.members_count,
          },
        },
        { onConflict: 'user_id,platform' },
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    if (err instanceof TelegramChannelError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
