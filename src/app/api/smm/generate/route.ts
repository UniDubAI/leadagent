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

const SUBMIT_POSTS_TOOL: Anthropic.Tool = {
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
            trend_basis: {
              type: 'string',
              description:
                "Agar trend qidiruvi ishlatilgan bo'lsa — ushbu post qaysi dolzarb trend yoki qidiruv natijasiga asoslanganini bir jumlada tushuntirish. Aks holda bo'sh qoldiring.",
            },
          },
          required: ['label', 'content'],
        },
      },
    },
    required: ['posts'],
  },
}

type GeneratedPosts = { posts: Array<{ label: string; content: string; trend_basis?: string }> }

async function generatePosts(systemPrompt: string, userPrompt: string, considerTrends: boolean): Promise<GeneratedPosts> {
  const tools: Anthropic.Tool[] = considerTrends
    ? [{ type: 'web_search_20260209', name: 'web_search' } as unknown as Anthropic.Tool, SUBMIT_POSTS_TOOL]
    : [SUBMIT_POSTS_TOOL]

  // Forcing tool_choice to submit_posts (non-trends path) guarantees structured
  // output in one round trip. With web search enabled the model must be free to
  // call web_search first, so tool_choice stays "auto" and we loop: server-side
  // search can pause_turn mid-way (resend as-is, no extra user message) before
  // the model finally emits the submit_posts tool call.
  const toolChoice: Anthropic.MessageCreateParams['tool_choice'] = considerTrends
    ? { type: 'auto' }
    : { type: 'tool', name: 'submit_posts' }

  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  for (let i = 0; i < 4; i++) {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools,
      tool_choice: toolChoice,
    })

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === 'submit_posts',
    )
    if (toolUse) return toolUse.input as GeneratedPosts

    if (message.stop_reason === 'pause_turn') {
      messages = [...messages, { role: 'assistant', content: message.content }]
      continue
    }

    throw new Error(`Claude did not return structured posts (stop_reason: ${message.stop_reason})`)
  }

  throw new Error('Claude did not return structured posts after multiple search rounds')
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { businessName, industry, platform, contentType, language, notes, considerTrends } = await req.json()

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

    const trendsInstruction = `

Trend qidiruvi yoqilgan: postlarni yozishdan oldin web_search tool orqali "${industry}" sohasi bo'yicha O'zbekistondagi dolzarb trendlar, yangiliklar va mavsumiy mavzularni qidiring (masalan: "${industry} trendlari 2026 Toshkent"). Topilgan dolzarb mavzularni postlar kontentiga tabiiy tarzda bog'lang. Har bir post uchun submit_posts'dagi trend_basis maydonida qaysi trend yoki manbaga asoslanganini bir jumlada yozing. Agar qidiruv natija bermasa yoki foydali trend topilmasa, oddiy sifatli kontent yozishda davom eting va trend_basis'ni bo'sh qoldiring.`

    const systemPrompt = `Siz professional SMM kontent yaratuvchisiz. Vazifangiz: kichik biznes uchun ijtimoiy tarmoq posti(lari)ni yozish.

Qoidalar:
- Har bir post quyidagi tuzilishga ega bo'lsin: diqqatni tortuvchi birinchi qator (hook) → foydali/qiziqarli qiymat → aniq CTA (harakatga chaqiruv).
- Reklama tilida YOZMANG. Tabiiy, foydali va inson tiliga yaqin yozing.
- Har bir postning oxiriga 5-8 ta relevant hashtag qo'shing.
- Emojidan me'yorida foydalaning — postni ortiqcha to'ldirmang.${considerTrends ? trendsInstruction : ''}`

    const userPrompt = `Biznes nomi: ${businessName}
Soha: ${industry}
Platforma: ${PLATFORM_LABELS[platform] ?? platform}
${notes ? `Qo'shimcha izoh: ${notes}` : ''}

${contentPlan}

Postlarni ${language} tilida yozing.`

    let generated: GeneratedPosts
    try {
      generated = await generatePosts(systemPrompt, userPrompt, Boolean(considerTrends))
    } catch (err) {
      if (considerTrends) {
        console.error(
          '[smm/generate] trend search failed, falling back to plain generation:',
          err instanceof Error ? err.message : String(err),
        )
        generated = await generatePosts(systemPrompt, userPrompt, false)
      } else {
        throw err
      }
    }

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
