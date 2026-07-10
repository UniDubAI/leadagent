import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, subject, body, leadId, messageId } = await req.json()

  if (!to || !subject || !body || !leadId) {
    return NextResponse.json(
      { error: 'to, subject, body, leadId are required' },
      { status: 400 },
    )
  }

  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const replyTo = process.env.REPLY_TO_EMAIL
  console.log('[send-email] sending from:', from)
  if (!replyTo) {
    console.warn('[send-email] REPLY_TO_EMAIL not set — replies will go to the from address')
  }

  const { error: sendError } = await resend.emails.send({
    from,
    to,
    subject,
    text: body,
    ...(replyTo ? { replyTo } : {}),
  })

  if (sendError) {
    console.error('[send-email] Resend error:', sendError.name, sendError.message)
    return NextResponse.json({ error: sendError.message }, { status: 500 })
  }

  const db = createServerClient()
  const now = new Date().toISOString()
  const { data: lead, error: dbError } = await db
    .from('leads')
    .update({ email_sent_at: now, last_contact_at: now })
    .eq('id', leadId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (dbError) {
    console.error('[send-email] Supabase error:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  if (messageId) {
    const { error: messageError } = await db
      .from('outreach_messages')
      .update({ status: 'sent', sent_at: now, subject, body })
      .eq('id', messageId)
      .eq('user_id', user.id)

    if (messageError) {
      console.error('[send-email] outreach_messages update error:', messageError.message)
    }
  }

  await sendTelegramMessage(`📧 Email yuborildi: ${lead.name}`)

  return NextResponse.json({ success: true, lead })
}
