import { NextResponse } from 'next/server'
import Anthropic, { APIError } from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import type { ConnectedAccount, InstagramAccountData, LeadStatus, RecommendationItem, TelegramAccountData } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAY_MS = 24 * 60 * 60 * 1000
const STALE_DAYS = 3

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Yangi',
  contacted: "Bog'lanildi",
  replied: 'Javob berdi',
  qualified: 'Malakali',
  closed_won: 'Yutildi',
  closed_lost: "Yo'qotildi",
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)
}

const ACTION_TYPES = ['email_yuborish', 'followup', 'smm_post', 'boshqa'] as const

const SUBMIT_RECOMMENDATIONS_TOOL: Anthropic.Tool = {
  name: 'submit_recommendations',
  description: 'Generatsiya qilingan amaliy tavsiyalarni topshirish',
  input_schema: {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: "Bitta aniq, amaliy tavsiya, o'zbek tilida, 1-2 gap",
            },
            action_type: {
              type: 'string',
              enum: ACTION_TYPES as unknown as string[],
              description:
                "Tavsiya turi: 'email_yuborish' — bitta lidga birinchi marta email yuborish kerak, 'followup' — javobsiz qolgan bitta lidga follow-up kerak, 'smm_post' — SMM/Telegram/Instagram kontent bilan bog'liq, 'boshqa' — hech qaysi lidga bog'liq bo'lmagan tavsiya",
            },
            lead_id: {
              type: 'string',
              description:
                "action_type 'email_yuborish' yoki 'followup' bo'lsa, promptdagi tegishli ro'yxatdan aynan shu lidning id'si. Aks holda bo'sh string ('')",
            },
            platform: {
              type: 'string',
              enum: ['telegram', 'instagram', ''],
              description:
                "action_type 'smm_post' bo'lsa va tavsiya aynan Telegram yoki Instagram'ga tegishli bo'lsa, shu maydonga platforma nomini yozing. Aks holda bo'sh string ('')",
            },
            context: {
              type: 'string',
              description:
                "5-8 so'zlik qisqa kontekst, foydalanuvchi tugmani bosganda mos formaning \"Qo'shimcha izoh\" maydoniga avtomatik yoziladi. 'followup' uchun masalan: \"follow-up: N kundan beri javob yo'q\". 'email_yuborish' uchun masalan: \"birinchi tanishuv xati, sohaga mos\". 'smm_post' uchun masalan: \"kanalga faollikni oshiruvchi qiziqarli post\". 'boshqa' uchun bo'sh string ('')",
            },
          },
          required: ['text', 'action_type', 'lead_id', 'platform', 'context'],
        },
        minItems: 3,
        maxItems: 6,
      },
    },
    required: ['recommendations'],
  },
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServerClient()
  const { data, error } = await db
    .from('recommendations')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServerClient()

    const { data: leads, error: leadsError } = await db
      .from('leads')
      .select('id, name, company, status, industry, email_sent_at, last_contact_at, created_at')
      .eq('user_id', user.id)

    if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })

    const { data: smmPosts, error: smmError } = await db
      .from('smm_posts')
      .select('created_at')
      .eq('user_id', user.id)

    if (smmError) return NextResponse.json({ error: smmError.message }, { status: 500 })

    const { data: connectedAccounts, error: accountsError } = await db
      .from('connected_accounts')
      .select('platform, account_name, data, updated_at')
      .eq('user_id', user.id)

    if (accountsError) return NextResponse.json({ error: accountsError.message }, { status: 500 })

    const { data: finance, error: financeError } = await db
      .from('business_finances')
      .select('monthly_revenue, monthly_expense, avg_receipt')
      .eq('user_id', user.id)
      .maybeSingle()

    if (financeError) return NextResponse.json({ error: financeError.message }, { status: 500 })

    const hasFinanceData = !!finance && (finance.monthly_revenue != null || finance.monthly_expense != null || finance.avg_receipt != null)

    // Brand-new account with nothing to analyze yet — skip the AI call and
    // give a friendly onboarding nudge instead of asking Claude to invent advice.
    if (leads.length === 0 && smmPosts.length === 0 && connectedAccounts.length === 0 && !hasFinanceData) {
      const items: RecommendationItem[] = [
        {
          text: "Hali lidlaringiz yo'q. Avval \"Qidiruv\" bo'limi yoki \"+ Yangi lid\" tugmasi orqali birinchi mijozingizni qo'shing — shundan keyin sizga moslashtirilgan tavsiyalar tayyor bo'ladi.",
          action_type: 'boshqa',
          lead_id: null,
          platform: null,
          context: null,
        },
      ]
      const { data: saved, error: saveError } = await db
        .from('recommendations')
        .upsert({ user_id: user.id, items, generated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select()
        .single()

      if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 })
      return NextResponse.json(saved)
    }

    const byStatus: Record<string, number> = {}
    const byIndustry: Record<string, number> = {}
    let emailsSentTotal = 0
    let emailsSentLast7Days = 0
    let newLeadsLast7Days = 0
    const staleLeads: Array<{ id: string; name: string; company: string | null; days: number }> = []
    const neverEmailed: Array<{ id: string; name: string; company: string | null }> = []

    for (const lead of leads) {
      byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1
      if (lead.industry) byIndustry[lead.industry] = (byIndustry[lead.industry] ?? 0) + 1

      if (lead.email_sent_at) {
        emailsSentTotal++
        if (daysSince(lead.email_sent_at) <= 7) emailsSentLast7Days++
      } else if (lead.status === 'new') {
        neverEmailed.push({ id: lead.id, name: lead.name, company: lead.company })
      }

      if (daysSince(lead.created_at) <= 7) newLeadsLast7Days++

      if (['new', 'contacted'].includes(lead.status) && lead.last_contact_at) {
        const days = daysSince(lead.last_contact_at)
        if (days >= STALE_DAYS) staleLeads.push({ id: lead.id, name: lead.name, company: lead.company, days })
      }
    }
    staleLeads.sort((a, b) => b.days - a.days)

    const topIndustries = Object.entries(byIndustry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    const smmTotal = smmPosts.length
    const smmLast7Days = smmPosts.filter((p) => daysSince(p.created_at) <= 7).length

    const statusLines = (Object.entries(byStatus) as Array<[LeadStatus, number]>)
      .map(([status, count]) => `${STATUS_LABELS[status] ?? status}: ${count}`)
      .join(', ')

    const industryLines = topIndustries.length
      ? topIndustries.map(([industry, count]) => `${industry} (${count} ta)`).join(', ')
      : "ma'lumot yo'q"

    const staleLines = staleLeads.length
      ? staleLeads.slice(0, 8).map((l) => `- id: ${l.id} — ${l.name}${l.company ? ` (${l.company})` : ''} — ${l.days} kundan beri javobsiz`).join('\n')
      : 'Yo\'q — barcha faol lidlar bilan yaqinda aloqa bo\'lgan.'

    const neverEmailedLines = neverEmailed.length
      ? neverEmailed.slice(0, 8).map((l) => `- id: ${l.id} — ${l.name}${l.company ? ` (${l.company})` : ''}`).join('\n')
      : "Yo'q — barcha yangi lidlarga birinchi email yuborilgan."

    const telegramAccount = (connectedAccounts as ConnectedAccount[]).find((a) => a.platform === 'telegram')
    const instagramAccount = (connectedAccounts as ConnectedAccount[]).find((a) => a.platform === 'instagram')

    const telegramLine = telegramAccount
      ? (() => {
          const d = telegramAccount.data as TelegramAccountData
          return `${telegramAccount.account_name} — ${d.members_count} obunachi (so'nggi tekshiruv: ${new Date(telegramAccount.updated_at).toLocaleDateString('uz-UZ')})`
        })()
      : "Ulanmagan — foydalanuvchi hali Telegram kanalini qo'shmagan."

    const instagramLine = instagramAccount
      ? (() => {
          const d = instagramAccount.data as InstagramAccountData
          return `${instagramAccount.account_name} — ${d.followers} obunachi, so'nggi 30 kunda ${d.posts_last_30d} post, o'rtacha ${d.avg_likes} like, o'rtacha ${d.avg_views} ko'rish`
        })()
      : "Ulanmagan — foydalanuvchi hali Instagram ma'lumotlarini kiritmagan."

    const financeLine = hasFinanceData
      ? (() => {
          const revenue = finance!.monthly_revenue
          const expense = finance!.monthly_expense
          const profit = revenue != null && expense != null ? revenue - expense : null
          return [
            revenue != null ? `oylik daromad: ${revenue} so'm` : null,
            expense != null ? `oylik xarajat: ${expense} so'm` : null,
            profit != null ? `taxminiy foyda: ${profit} so'm` : null,
            finance!.avg_receipt != null ? `o'rtacha chek: ${finance!.avg_receipt} so'm` : null,
          ].filter(Boolean).join(', ')
        })()
      : "Kiritilmagan — foydalanuvchi hali moliya ma'lumotlarini to'ldirmagan."

    const userPrompt = `Quyidagi statistikaga asoslanib, foydalanuvchiga to'liq biznes auditi sifatida 3-6 ta aniq, amaliy, o'zbek tilidagi tavsiya bering.

## Lidlar va outreach
Jami lidlar: ${leads.length}
Status bo'yicha: ${statusLines}
Top sohalar: ${industryLines}
So'nggi 7 kunda qo'shilgan yangi lidlar: ${newLeadsLast7Days}
Yuborilgan emaillar (jami): ${emailsSentTotal}, so'nggi 7 kunda: ${emailsSentLast7Days}

3+ kun javobsiz qolgan lidlar (follow-up uchun, id bilan):
${staleLines}

Birinchi marta email kerak bo'lgan yangi lidlar (id bilan):
${neverEmailedLines}

## SMM kontent faolligi
Jami generatsiya qilingan post/reja soni: ${smmTotal}, so'nggi 7 kunda: ${smmLast7Days}

## Telegram kanal
${telegramLine}

## Instagram
${instagramLine}

## Moliya
${financeLine}`

    const systemPrompt = `Siz kichik bizneslar uchun to'liq biznes auditi o'tkazadigan maslahatchisiz — savdo (lidlar), marketing (SMM, Telegram, Instagram) va moliya bo'yicha. Foydalanuvchi — kichik biznes egasi, texnik bilimi yo'q. Berilgan raqamli statistikaga asoslanib, har bir yo'nalishdagi kamchiliklarni aniqlab, aniq yechim bering.

Har bir tavsiya uchun action_type va lead_id shart:
- "email_yuborish": promptdagi "Birinchi marta email kerak bo'lgan yangi lidlar" ro'yxatidan bitta lidga tegishli bo'lsa — lead_id'ga aynan shu lidning id'sini yozing.
- "followup": promptdagi "3+ kun javobsiz qolgan lidlar" ro'yxatidan bitta lidga tegishli bo'lsa — lead_id'ga aynan shu lidning id'sini yozing.
- "smm_post": SMM/Telegram/Instagram kontent faolligiga tegishli tavsiya bo'lsa — lead_id'ni bo'sh string ("") qoldiring.
- "boshqa": moliya, umumiy strategiya va hech qaysi lidga bog'liq bo'lmagan tavsiyalar — lead_id'ni bo'sh string ("") qoldiring.
- lead_id faqat yuqoridagi ro'yxatlarda berilgan id'lardan bo'lishi kerak, o'zingizdan id o'ylab topmang.
- Bir xil lidga ikkita alohida tavsiya bag'ishlamang.
- "smm_post" bo'lsa, tavsiya aynan Telegram yoki Instagram bilan bog'liq bo'lsa platform maydonini to'ldiring (masalan Telegram kanal faolligi past bo'lsa platform="telegram").
- Har bir tavsiya uchun context maydoniga qisqa (5-8 so'z) izoh yozing — bu izoh "Generatsiya qilish" formasining "Qo'shimcha izoh" maydoniga avtomatik tushadi, shuning uchun aniq va amaliy bo'lsin.

Qoidalar:
- 3 tadan 6 tagacha tavsiya bering, har biri 1-2 gap, oddiy va tushunarli tilda.
- Ma'lumot mavjud bo'lgan har bir yo'nalishni (lidlar, Telegram, Instagram, moliya) qamrab olishga harakat qiling — biror yo'nalish ulanmagan/kiritilmagan bo'lsa, buni ham aytib, ulashni/kiritishni tavsiya qiling.
- Moliya ma'lumoti mavjud bo'lsa, daromad-xarajat nisbatidagi aniq muammoni yoki imkoniyatni ko'rsating (masalan: foyda past, xarajatni qaysi joyda qisqartirish mumkin).
- Telegram/Instagram ma'lumoti mavjud bo'lsa, o'sish yoki faollik bo'yicha aniq muammoni ko'rsating (masalan: obunachi soniga nisbatan like/ko'rish past — bu qiziqarli emas degani).
- Sayoz yoki umumiy maslahat bermang ("marketingga ko'proq e'tibor bering" kabi) — faqat berilgan raqamlar va nomlarga asoslaning.
- Agar muayyan lid javobsiz qolgan bo'lsa, uning ismini aniq ko'rsating (masalan: "Bobur Jamgirov 4 kundan beri javobsiz — follow-up yuboring").
- Agar emaillar kam yuborilgan bo'lsa, aniq raqam bilan ayting (masalan: "Bu hafta faqat 1 email yubordingiz — kuniga 2-3 taga oshiring").
- Agar SMM faolligi past bo'lsa, shuni ham eslating.
- Faqat o'zbek tilida yozing.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [SUBMIT_RECOMMENDATIONS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_recommendations' },
    })

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === 'submit_recommendations',
    )
    if (!toolUse) {
      return NextResponse.json({ error: 'Claude tavsiyalarni qaytarmadi' }, { status: 500 })
    }

    const rawItems = (toolUse.input as {
      recommendations: Array<{ text: string; action_type: string; lead_id: string; platform: string; context: string }>
    }).recommendations

    const validLeadIds = new Set(leads.map((l) => l.id))
    const items: RecommendationItem[] = rawItems.map((r) => ({
      text: r.text,
      action_type: (ACTION_TYPES as readonly string[]).includes(r.action_type)
        ? (r.action_type as RecommendationItem['action_type'])
        : 'boshqa',
      lead_id: r.lead_id && validLeadIds.has(r.lead_id) ? r.lead_id : null,
      platform: r.platform === 'telegram' || r.platform === 'instagram' ? r.platform : null,
      context: r.context?.trim() || null,
    }))

    const { data: saved, error: saveError } = await db
      .from('recommendations')
      .upsert({ user_id: user.id, items, generated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single()

    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 })

    return NextResponse.json(saved)
  } catch (err: unknown) {
    if (err instanceof APIError) {
      console.error('[recommendations] anthropic error:', err.status, err.message)
      return NextResponse.json({ error: err.message, code: err.error?.type }, { status: err.status ?? 500 })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[recommendations] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
