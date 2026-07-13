import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import type { OutreachTone } from '@/types'

const OUTREACH_TONES: OutreachTone[] = ['formal', 'neutral', 'friendly']

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServerClient()
  const { data, error } = await db
    .from('user_settings')
    .select('outreach_tone, followup_delay_days, followup_max_count, signature, created_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { outreach_tone, followup_delay_days, followup_max_count, signature } = await req.json()

  if (!OUTREACH_TONES.includes(outreach_tone)) {
    return NextResponse.json({ error: "outreach_tone noto'g'ri" }, { status: 400 })
  }
  if (!Number.isInteger(followup_delay_days) || followup_delay_days <= 0) {
    return NextResponse.json({ error: 'followup_delay_days musbat butun son bo\'lishi kerak' }, { status: 400 })
  }
  if (!Number.isInteger(followup_max_count) || followup_max_count < 0) {
    return NextResponse.json({ error: "followup_max_count manfiy bo'lmagan butun son bo'lishi kerak" }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('user_settings')
    .upsert(
      {
        user_id: user.id,
        outreach_tone,
        followup_delay_days,
        followup_max_count,
        signature: signature?.trim() || null,
      },
      { onConflict: 'user_id' },
    )
    .select('outreach_tone, followup_delay_days, followup_max_count, signature, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
