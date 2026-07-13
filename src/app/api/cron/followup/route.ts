import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import { generateFollowupEmail, buildSignerName } from '@/lib/outreach-email'
import type { OutreachTone } from '@/types'

const DAY_MS = 24 * 60 * 60 * 1000
const resend = new Resend(process.env.RESEND_API_KEY)

interface FollowupSettings {
  outreach_tone: OutreachTone
  followup_delay_days: number
  followup_max_count: number
  signature: string | null
}

const DEFAULT_SETTINGS: FollowupSettings = {
  outreach_tone: 'neutral',
  followup_delay_days: 3,
  followup_max_count: 1,
  signature: null,
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const db = createServerClient()
  // Har bir tenantning follow-up muddati/soni turlicha bo'lishi mumkin
  // (user_settings), shuning uchun bu yerda faqat keng filtr qo'llanadi —
  // aniq "necha kun o'tdi" va "necha marta yuborilgan" tekshiruvi pastda,
  // har bir lidning o'z tenanti sozlamalari bilan, JS darajasida bo'ladi.
  const { data: leads, error } = await db
    .from('leads')
    .select('*')
    .in('status', ['new', 'contacted'])
    .not('last_contact_at', 'is', null)

  if (error) {
    console.error('[cron/followup] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const replyTo = process.env.REPLY_TO_EMAIL
  if (!replyTo) {
    console.warn('[cron/followup] REPLY_TO_EMAIL not set — replies will go to the from address')
  }

  const userIds = [...new Set((leads ?? []).map((l) => l.user_id))]

  // Har bir foydalanuvchining "Ism, Kompaniya" imzosi email imzosi sifatida
  // ishlatiladi (modelga aniq ism berilmasa, u "[Ismingiz]" kabi placeholder yozib qo'yardi).
  const { data: profiles } = userIds.length
    ? await db.from('business_profiles').select('user_id, owner_name, business_name').in('user_id', userIds)
    : { data: [] }
  const signerNameByUser = new Map((profiles ?? []).map((p) => [p.user_id, buildSignerName(p)]))

  // Har bir tenantning outreach ohangi, follow-up muddati/soni va imzosi.
  const { data: settingsRows } = userIds.length
    ? await db
        .from('user_settings')
        .select('user_id, outreach_tone, followup_delay_days, followup_max_count, signature')
        .in('user_id', userIds)
    : { data: [] }
  const settingsByUser = new Map<string, FollowupSettings>(
    (settingsRows ?? []).map((s) => [
      s.user_id,
      {
        outreach_tone: s.outreach_tone,
        followup_delay_days: s.followup_delay_days,
        followup_max_count: s.followup_max_count,
        signature: s.signature,
      },
    ]),
  )

  const eligibleLeads = (leads ?? []).filter((lead) => {
    const settings = settingsByUser.get(lead.user_id) ?? DEFAULT_SETTINGS
    if (lead.followup_count >= settings.followup_max_count) return false
    const delayThreshold = new Date(now.getTime() - settings.followup_delay_days * DAY_MS)
    return new Date(lead.last_contact_at) <= delayThreshold
  })

  let emailed = 0
  let nudged = 0

  for (const lead of eligibleLeads) {
    const settings = settingsByUser.get(lead.user_id) ?? DEFAULT_SETTINGS

    // Emaili bor lidlarga follow-up email avtomatik yuboriladi; qolganlariga
    // (masalan faqat LinkedIn/Telegram orqali topilgan lidlar) hozirgidek
    // Telegram orqali qo'lda follow-up qilish eslatmasi yuboriladi.
    if (lead.email) {
      try {
        const signerName = signerNameByUser.get(lead.user_id) || 'Bizning jamoa'
        const { subject, body } = await generateFollowupEmail(
          lead,
          signerName,
          settings.outreach_tone,
          settings.signature,
        )

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
          .update({
            email_sent_at: sentAt,
            last_contact_at: sentAt,
            followup_sent_at: sentAt,
            followup_count: lead.followup_count + 1,
          })
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
        `🔔 Follow-up: ${lead.name}${lead.company ? ` (${lead.company})` : ''} — ${settings.followup_delay_days} kundan beri javob yo'q. Qayta bog'laning!`,
      )
      await db
        .from('leads')
        .update({ followup_sent_at: now.toISOString(), followup_count: lead.followup_count + 1 })
        .eq('id', lead.id)
      nudged++
    }
  }

  return NextResponse.json({
    processed: eligibleLeads.length,
    emailed,
    nudged,
    leadIds: eligibleLeads.map((l) => l.id),
  })
}
