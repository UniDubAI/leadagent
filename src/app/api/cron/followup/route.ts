import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import { generateFollowupEmail } from '@/lib/outreach-email'

const DAY_MS = 24 * 60 * 60 * 1000
const resend = new Resend(process.env.RESEND_API_KEY)

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

  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const replyTo = process.env.REPLY_TO_EMAIL

  let emailed = 0
  let nudged = 0

  for (const lead of leads ?? []) {
    // Emaili bor lidlarga follow-up email avtomatik yuboriladi; qolganlariga
    // (masalan faqat LinkedIn/Telegram orqali topilgan lidlar) hozirgidek
    // Telegram orqali qo'lda follow-up qilish eslatmasi yuboriladi.
    if (lead.email) {
      try {
        const { subject, body } = await generateFollowupEmail(lead)

        const { error: sendError } = await resend.emails.send({
          from,
          to: lead.email,
          subject,
          text: body,
          ...(replyTo ? { replyTo } : {}),
        })

        if (sendError) throw new Error(sendError.message)

        const sentAt = new Date().toISOString()

        await db
          .from('leads')
          .update({ email_sent_at: sentAt, last_contact_at: sentAt, followup_sent_at: sentAt })
          .eq('id', lead.id)

        await db.from('outreach_messages').insert({
          user_id: lead.user_id,
          lead_id: lead.id,
          channel: 'email',
          subject,
          body,
          status: 'sent',
          sent_at: sentAt,
        })

        await sendTelegramMessage(
          `📧 Follow-up email avtomatik yuborildi: ${lead.name}${lead.company ? ` (${lead.company})` : ''}`,
        )
        emailed++
      } catch (err) {
        console.error(
          '[cron/followup] email error for lead',
          lead.id,
          err instanceof Error ? err.message : err,
        )
        await sendTelegramMessage(
          `⚠️ Follow-up email yuborilmadi: ${lead.name} — xatolik yuz berdi, qo'lda tekshiring.`,
        )
      }
    } else {
      await sendTelegramMessage(
        `🔔 Follow-up: ${lead.name}${lead.company ? ` (${lead.company})` : ''} — 3 kundan beri javob yo'q. Qayta bog'laning!`,
      )
      await db
        .from('leads')
        .update({ followup_sent_at: now.toISOString() })
        .eq('id', lead.id)
      nudged++
    }
  }

  return NextResponse.json({
    processed: leads?.length ?? 0,
    emailed,
    nudged,
    leadIds: leads?.map((l) => l.id) ?? [],
  })
}
