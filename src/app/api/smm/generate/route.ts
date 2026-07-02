import { NextRequest, NextResponse } from 'next/server'
import Anthropic, { APIError } from '@anthropic-ai/sdk'
import { getUser } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  telegram: 'Telegram',
  both: 'Instagram va Telegram (ikkalasida ham ishlatsa bo\'ladigan uslubda)',
}

const CONTENT_PLANS: Record<string, string> = {
  single: '1 ta post yozing.',
  weekly: `7 kunlik kontent-plan yozing — 7 ta post, har biri quyidagi tartib va turda, aynan shu ketma-ketlikda:
1. Foydali maslahat
2. Mahsulot/xizmat tanishtiruvi
3. Ijtimoiy isbot (mijoz fikri yoki natija)
4. Savol-javob
5. Sahna ortida
6. Aksiya/chegirma
7. Jamiyat bilan muloqot (savol berish, fikr so'rash)`,
  launch: `2 haftalik zapusk (launch) rejasi yozing — jami 9 ta post, aynan shu tartib va guruhlarda:
- Isitish: 3 ta post (qiziqish uyg'otish, hali mahsulot to'liq oshkor qilinmaydi)
- E'lon: 2 ta post (mahsulot/xizmat rasman e'lon qilinadi)
- Sotuv: 3 ta post (sotishga undovchi, kuchli CTA)
- Yopilish: 1 ta post (oxirgi imkoniyat, muddat tugashi)`,
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { businessName, industry, platform, contentType, language, notes } = await req.json()

    if (!businessName || !industry || !platform || !contentType || !language) {
      return NextResponse.json(
        { error: 'businessName, industry, platform, contentType, language required' },
        { status: 400 },
      )
    }

    const contentPlan = CONTENT_PLANS[contentType]
    if (!contentPlan) {
      return NextResponse.json({ error: 'Invalid contentType' }, { status: 400 })
    }

    const systemPrompt = `Siz professional SMM kontent yaratuvchisiz. Vazifangiz: kichik biznes uchun ijtimoiy tarmoq posti(lari)ni yozish.

Qoidalar:
- Har bir post quyidagi tuzilishga ega bo'lsin: diqqatni tortuvchi birinchi qator (hook) → foydali/qiziqarli qiymat → aniq CTA (harakatga chaqiruv).
- Reklama tilida YOZMANG. Tabiiy, foydali va inson tiliga yaqin yozing.
- Har bir postning oxiriga 5-8 ta relevant hashtag qo'shing.
- Emojidan me'yorida foydalaning — postni ortiqcha to'ldirmang.`

    const userPrompt = `Biznes nomi: ${businessName}
Soha: ${industry}
Platforma: ${PLATFORM_LABELS[platform] ?? platform}
${notes ? `Qo'shimcha izoh: ${notes}` : ''}

${contentPlan}

Postlarni ${language} tilida yozing.`

    // Structured tool-use output instead of asking the model to hand-write
    // JSON in plain text: for 7-9 post responses, freeform JSON reliably
    // came back with malformed closing brackets near the end.
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [
        {
          name: 'submit_posts',
          description: 'Generatsiya qilingan SMM postlarini topshirish',
          input_schema: {
            type: 'object',
            properties: {
              posts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: "Postning qisqa nomi, masalan '1-kun: Foydali maslahat'" },
                    content: { type: 'string', description: "To'liq post matni, hashtaglar bilan" },
                  },
                  required: ['label', 'content'],
                },
              },
            },
            required: ['posts'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_posts' },
    })

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    )
    if (!toolUse) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const generated = toolUse.input as { posts: Array<{ label: string; content: string }> }

    return NextResponse.json({ posts: generated.posts })
  } catch (err: unknown) {
    if (err instanceof APIError) {
      console.error('[smm/generate] anthropic error:', err.status, err.message)
      return NextResponse.json(
        { error: err.message, code: err.error?.type },
        { status: err.status ?? 500 },
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[smm/generate] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
