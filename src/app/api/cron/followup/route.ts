import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * DAY_MS).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString()

  const db = createServerClient()
  const { data: leads, error } = await db
    .from('leads')
    .select('*')
    .in('status', ['new', 'contacted'])
    .lte('last_contact_at', threeDaysAgo)
    .or(`followup_sent_at.is.null,followup_sent_at.lte.${sevenDaysAgo}`)

  if (error) {
    console.error('[cron/followup] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const lead of leads ?? []) {
    await sendTelegramMessage(
      `🔔 Follow-up: ${lead.name}${lead.company ? ` (${lead.company})` : ''} — 3 kundan beri javob yo'q. Qayta bog'laning!`,
    )
    await db
      .from('leads')
      .update({ followup_sent_at: now.toISOString() })
      .eq('id', lead.id)
  }

  return NextResponse.json({
    processed: leads?.length ?? 0,
    leadIds: leads?.map((l) => l.id) ?? [],
  })
}
