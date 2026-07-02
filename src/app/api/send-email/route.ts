import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, subject, body, leadId } = await req.json()

  if (!to || !subject || !body || !leadId) {
    return NextResponse.json(
      { error: 'to, subject, body, leadId are required' },
      { status: 400 },
    )
  }

  const { error: sendError } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to,
    subject,
    text: body,
  })

  if (sendError) {
    console.error('[send-email] Resend error:', sendError.name, sendError.message)
    return NextResponse.json({ error: sendError.message }, { status: 500 })
  }

  const db = createServerClient()
  const { data: lead, error: dbError } = await db
    .from('leads')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', leadId)
    .select()
    .single()

  if (dbError) {
    console.error('[send-email] Supabase error:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  await sendTelegramMessage(`📧 Email yuborildi: ${lead.name}`)

  return NextResponse.json({ success: true, lead })
}
