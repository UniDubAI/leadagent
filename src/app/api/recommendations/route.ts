import { NextResponse } from 'next/server'
import Anthropic, { APIError } from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import type { LeadStatus } from '@/types'

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

const SUBMIT_RECOMMENDATIONS_TOOL: Anthropic.Tool = {
  name: 'submit_recommendations',
  description: 'Generatsiya qilingan amaliy tavsiyalarni topshirish',
  input_schema: {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        items: {
          type: 'string',
          description: "Bitta aniq, amaliy tavsiya, o'zbek tilida, 1-2 gap",
        },
        minItems: 3,
        maxItems: 5,
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
      .select('name, company, status, industry, email_sent_at, last_contact_at, created_at')
      .eq('user_id', user.id)

    if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })

    const { data: smmPosts, error: smmError } = await db
      .from('smm_posts')
      .select('created_at')
      .eq('user_id', user.id)

    if (smmError) return NextResponse.json({ error: smmError.message }, { status: 500 })

    // Brand-new account with nothing to analyze yet — skip the AI call and
    // give a friendly onboarding nudge instead of asking Claude to invent advice.
    if (leads.length === 0) {
      const items = [
        "Hali lidlaringiz yo'q. Avval \"Qidiruv\" bo'limi yoki \"+ Yangi lid\" tugmasi orqali birinchi mijozingizni qo'shing — shundan keyin sizga moslashtirilgan tavsiyalar tayyor bo'ladi.",
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
    const staleLeads: Array<{ name: string; company: string | null; days: number }> = []

    for (const lead of leads) {
      byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1
      if (lead.industry) byIndustry[lead.industry] = (byIndustry[lead.industry] ?? 0) + 1

      if (lead.email_sent_at) {
        emailsSentTotal++
        if (daysSince(lead.email_sent_at) <= 7) emailsSentLast7Days++
      }

      if (daysSince(lead.created_at) <= 7) newLeadsLast7Days++

      if (['new', 'contacted'].includes(lead.status) && lead.last_contact_at) {
        const days = daysSince(lead.last_contact_at)
        if (days >= STALE_DAYS) staleLeads.push({ name: lead.name, company: lead.company, days })
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
      ? staleLeads.slice(0, 8).map((l) => `- ${l.name}${l.company ? ` (${l.company})` : ''} — ${l.days} kundan beri javobsiz`).join('\n')
      : 'Yo\'q — barcha faol lidlar bilan yaqinda aloqa bo\'lgan.'

    const userPrompt = `Quyidagi statistikaga asoslanib, foydalanuvchiga 3-5 ta aniq, amaliy, o'zbek tilidagi tavsiya bering.

Jami lidlar: ${leads.length}
Status bo'yicha: ${statusLines}
Top sohalar: ${industryLines}
So'nggi 7 kunda qo'shilgan yangi lidlar: ${newLeadsLast7Days}
Yuborilgan emaillar (jami): ${emailsSentTotal}, so'nggi 7 kunda: ${emailsSentLast7Days}

3+ kun javobsiz qolgan lidlar:
${staleLines}

SMM: jami generatsiya qilingan post/reja soni: ${smmTotal}, so'nggi 7 kunda: ${smmLast7Days}`

    const systemPrompt = `Siz B2B savdo va marketing bo'yicha maslahatchisiz. Foydalanuvchi — kichik biznes egasi, texnik bilimi yo'q. Berilgan raqamli statistikaga asoslanib, aniq va amaliy tavsiyalar bering.

Qoidalar:
- 3 tadan 5 tagacha tavsiya bering, har biri 1-2 gap, oddiy va tushunarli tilda.
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

    const items = (toolUse.input as { recommendations: string[] }).recommendations

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
