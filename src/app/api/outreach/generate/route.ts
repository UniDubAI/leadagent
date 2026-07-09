import { NextRequest, NextResponse } from 'next/server'
import Anthropic, { APIError } from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { lead_id, channel, context, language: languageOverride } = await req.json()

    if (!lead_id || !channel) {
      return NextResponse.json({ error: 'lead_id and channel required' }, { status: 400 })
    }

    const db = createServerClient()
    const { data: lead, error } = await db
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .eq('user_id', user.id)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const langMap: Record<string, string> = {
      "O'zbek": 'Uzbek',
      'Rus': 'Russian',
      'Ingliz': 'English',
    }
    // Lid tilida til belgilanmagan bo'lsa, O'zbek tiliga default qilamiz —
    // avvalgi 'English' default OSM qidiruvdan kelgan lidlarga inglizcha xabar yozib yuborardi.
    const language = langMap[languageOverride] ?? langMap[lead.message_language] ?? 'Uzbek'

    // Uzbek-tilidagi majburiy ko'rsatma — model boshqa tilga "sirg'alib ketmasligi" uchun
    // sistem promptning boshida ham, oxirida ham qat'iy takrorlanadi.
    const langInstructionMap: Record<string, string> = {
      Uzbek: "Javobni FAQAT o'zbek tilida yoz.",
      Russian: 'Javobni FAQAT rus tilida yoz.',
      English: 'Javobni FAQAT ingliz tilida yoz.',
    }
    const languageInstruction = langInstructionMap[language]

    const CHANNEL_LABELS: Record<string, string> = {
      email: 'email',
      linkedin: 'LinkedIn xabar',
      telegram: 'Telegram xabar',
      instagram: 'Instagram DM',
    }

    const systemPromptMap: Record<string, string> = {
      email: `Siz B2B savdo mutaxassisisiz. Vazifangiz: mijozga shaxsiylashtirilgan, qisqa va tabiiy tuyuladigan sovuq email yozish.

MAJBURIY TIL QOIDASI: ${languageInstruction} Boshqa tilda birorta so'z ham yozmang — bu qoida hamma narsadan ustun.

Qoidalar:
- Reklama tilida YOZMANG. Oddiy, insoniy ohangda yozing.
- Birinchi gap diqqatni tortsin — mijozning sohasiga yoki kompaniyasiga aloqador bo'lsin.
- 3-4 qisqa paragraf: muammo/vaziyat → qisqa taklif → CTA.
- CTA yumshoq bo'lsin: "15 daqiqalik qo'ng'iroq", "fikringizni bilsam" kabi.
- Har doim JSON formatida qaytaring: {"subject": "...", "body": "..."}
- ${languageInstruction}`,
      linkedin: `Siz B2B savdo mutaxassisisiz. Vazifangiz: LinkedIn uchun ikkita alohida matn yozish — qisqa connection so'rovi va connection qabul qilingandan keyin yuboriladigan to'liqroq DM xabari.

MAJBURIY TIL QOIDASI: ${languageInstruction} Boshqa tilda birorta so'z ham yozmang — bu qoida hamma narsadan ustun.

Qoidalar:
- "connection_request": MAKSIMAL 300 belgi. Juda qisqa, tabiiy, bitta aniq sabab bilan tanishuv taklifi. Reklama emas.
- "dm": to'liqroq DM/InMail xabari, maksimal 1000 belgi. Muammo/vaziyat → qisqa taklif → yumshoq CTA.
- Ikkalasi ham oddiy, do'stona ohangda — reklama emas, tanishish xabari kabi.
- Mijozning sohasiga mos bitta aniq sabab ko'rsating.
- Har doim JSON formatida qaytaring: {"connection_request": "...", "dm": "..."}
- ${languageInstruction}`,
      telegram: `Siz B2B savdo mutaxassisisiz. Vazifangiz: Telegram orqali qo'lda yuboriladigan qisqa, do'stona xabar yozish — bu rasmiy email emas, Telegram muloqot uslubida yozilishi kerak.

MAJBURIY TIL QOIDASI: ${languageInstruction} Boshqa tilda birorta so'z ham yozmang — bu qoida hamma narsadan ustun.

Qoidalar:
- 3-5 qisqa gap. Do'stona, tabiiy ohangda — rasmiy email tili emas, xuddi tanish odamga yozayotgandek.
- Reklama tilida YOZMANG.
- Mijozning ismi/sohasiga mos bitta aniq sabab ko'rsating.
- Yumshoq CTA bilan tugating (masalan: "qisqa gaplashib olsak", "fikringizni bilsam bo'ladimi").
- Har doim JSON formatida qaytaring: {"message": "..."}
- ${languageInstruction}`,
      instagram: `Siz B2B savdo mutaxassisisiz. Vazifangiz: Instagram DM uchun juda qisqa, yengil ohangdagi xabar yozish.

MAJBURIY TIL QOIDASI: ${languageInstruction} Boshqa tilda birorta so'z ham yozmang — bu qoida hamma narsadan ustun.

Qoidalar:
- Atigi 2-3 qisqa gap. Instagram DM uslubida — yengil, samimiy, rasmiy emas.
- Reklama tilida YOZMANG.
- Mijozning sohasiga mos bitta aniq sabab yoki qisqa komplement bilan boshlang.
- Yumshoq savol/taklif bilan tugating.
- Har doim JSON formatida qaytaring: {"message": "..."}
- ${languageInstruction}`,
    }

    const systemPrompt = systemPromptMap[channel]
    if (!systemPrompt) {
      return NextResponse.json({ error: "Noto'g'ri channel" }, { status: 400 })
    }

    const userPrompt = `Quyidagi lid uchun ${CHANNEL_LABELS[channel]} yozing:

Ism: ${lead.name}
Kompaniya: ${lead.company || 'noma\'lum'}
Soha: ${lead.industry || 'noma\'lum'}
Email: ${lead.email || 'N/A'}
${context ? `Qo'shimcha ma'lumot: ${context}` : ''}

${languageInstruction} Shaxsiylashtirilgan, qisqa va tabiiy yozing.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 500 })
    }

    const generated = JSON.parse(jsonMatch[0])

    // For LinkedIn, the "subject" column doubles up as the short connection
    // request text so the two variants can be generated and stored together
    // without a schema change; "body" holds the longer DM/InMail text.
    // Telegram/Instagram only ever produce a single message -> body only.
    let subject: string | null = null
    let body: string
    if (channel === 'email') {
      subject = generated.subject ?? null
      body = generated.body
    } else if (channel === 'linkedin') {
      subject = generated.connection_request
      body = generated.dm
    } else {
      body = generated.message
    }

    const { data: saved } = await db
      .from('outreach_messages')
      .insert({
        user_id: user.id,
        lead_id,
        channel,
        subject,
        body,
        status: 'draft',
      })
      .select()
      .single()

    return NextResponse.json({ message: saved, generated })
  } catch (err: unknown) {
    if (err instanceof APIError) {
      console.error('[generate] anthropic error:', err.status, err.message)
      return NextResponse.json(
        { error: err.message, code: err.error?.type },
        { status: err.status ?? 500 },
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
