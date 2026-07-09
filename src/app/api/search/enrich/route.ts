import { NextRequest, NextResponse } from 'next/server'
import Anthropic, { APIError } from '@anthropic-ai/sdk'
import { getUser } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SUBMIT_ENRICHMENT_TOOL: Anthropic.Tool = {
  name: 'submit_enrichment',
  description: "Web qidiruv orqali topilgan biznes kontakt ma'lumotlarini topshirish",
  input_schema: {
    type: 'object',
    properties: {
      phone: {
        type: 'string',
        description: "Topilgan telefon raqami (xalqaro formatda). Aniq topilmasa bo'sh string ('')",
      },
      email: {
        type: 'string',
        description: "Topilgan email manzil. Aniq topilmasa bo'sh string ('')",
      },
      instagram: {
        type: 'string',
        description: "Topilgan Instagram profil havolasi yoki @username. Aniq topilmasa bo'sh string ('')",
      },
      telegram: {
        type: 'string',
        description: "Topilgan Telegram kanal/profil havolasi yoki @username. Aniq topilmasa bo'sh string ('')",
      },
    },
    required: ['phone', 'email', 'instagram', 'telegram'],
  },
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, city, address } = await req.json()
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: "Biznes nomi kiritilmadi" }, { status: 400 })
    }

    const systemPrompt = `Siz biznes haqida internet orqali kontakt ma'lumot qidiruvchi yordamchisiz.

Vazifa: web_search orqali berilgan biznesning rasmiy telefon raqami, email, Instagram va Telegram havolalarini toping.

Qoidalar:
- Faqat ishonchli manbalarga tayaning: biznesning rasmiy sayti, Google Maps/Google Business profili, yoki Instagram/Telegram profilining o'zi.
- Bir nechta nomdosh natija chiqsa, berilgan shahar/manzilga eng mos keladiganini tanlang.
- Biror maydonni ishonchli topa olmasangiz, uni bo'sh string ("") qoldiring — taxmin qilmang.
- Qidiruvni tugatgach, natijani albatta submit_enrichment tool orqali qaytaring.`

    const userPrompt = `Biznes: "${name}"${address ? `, manzil: ${address}` : ''}${city ? `, shahar: ${city}` : ''}.

Ushbu biznesning telefon raqami, email, Instagram va Telegram havolalarini toping.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 3 },
        SUBMIT_ENRICHMENT_TOOL,
      ],
    })

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === 'submit_enrichment',
    )

    if (!toolUse) {
      return NextResponse.json({ error: "Claude qidiruv natijasini qaytarmadi" }, { status: 500 })
    }

    const result = toolUse.input as { phone: string; email: string; instagram: string; telegram: string }

    return NextResponse.json({
      phone: result.phone?.trim() || null,
      email: result.email?.trim() || null,
      instagram: result.instagram?.trim() || null,
      telegram: result.telegram?.trim() || null,
    })
  } catch (err: unknown) {
    if (err instanceof APIError) {
      console.error('[search/enrich] anthropic error:', err.status, err.message)
      return NextResponse.json({ error: err.message, code: err.error?.type }, { status: err.status ?? 500 })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[search/enrich] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
