import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { message_id } = await req.json()

  if (!message_id) {
    return NextResponse.json({ error: 'message_id required' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: msg, error } = await db
    .from('outreach_messages')
    .select('*, leads(*)')
    .eq('id', message_id)
    .single()

  if (error || !msg) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (msg.channel !== 'email') {
    return NextResponse.json({ error: 'Not an email message' }, { status: 400 })
  }

  if (!msg.leads?.email) {
    return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 })
  }

  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: msg.leads.email,
    subject: msg.subject ?? '(no subject)',
    text: msg.body,
  })

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 })
  }

  // Mark as sent
  await db
    .from('outreach_messages')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', message_id)

  // Update lead status to contacted if still new
  if (msg.leads.status === 'new') {
    await db
      .from('leads')
      .update({ status: 'contacted' })
      .eq('id', msg.lead_id)
  }

  return NextResponse.json({ success: true })
}
