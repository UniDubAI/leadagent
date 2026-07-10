import Anthropic from '@anthropic-ai/sdk'
import type { Lead } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const LANG_MAP: Record<string, string> = {
  "O'zbek": 'Uzbek',
  Rus: 'Russian',
  Ingliz: 'English',
}

const LANG_INSTRUCTION_MAP: Record<string, string> = {
  Uzbek: "Javobni FAQAT o'zbek tilida yoz.",
  Russian: 'Javobni FAQAT rus tilida yoz.',
  English: 'Javobni FAQAT ingliz tilida yoz.',
}

type FollowupLead = Pick<Lead, 'name' | 'company' | 'industry' | 'message_language'>

// Lidning avvalgi kontaktidan 3+ kun o'tgach, cron orqali avtomatik yuboriladigan
// follow-up email matnini generatsiya qiladi. Cold outreach'dan farqli o'laroq,
// bu allaqachon bir marta yozilgan lidga "eslatma" ohangida bo'ladi.
export async function generateFollowupEmail(
  lead: FollowupLead,
): Promise<{ subject: string; body: string }> {
  const language = LANG_MAP[lead.message_language ?? ''] ?? 'Uzbek'
  const languageInstruction = LANG_INSTRUCTION_MAP[language]

  const systemPrompt = `Siz B2B savdo mutaxassisisiz. Vazifangiz: bir necha kun oldin birinchi marta yozilgan, lekin javob kelmagan mijozga qisqa follow-up (eslatma) email yozish.

MAJBURIY TIL QOIDASI: ${languageInstruction} Boshqa tilda birorta so'z ham yozmang — bu qoida hamma narsadan ustun.

Qoidalar:
- Bu birinchi email emas, eslatma — "yana bir bor yozyapman" ohangida, lekin bosim o'tkazmasdan.
- Reklama tilida YOZMANG. Oddiy, insoniy ohangda yozing.
- Juda qisqa: 2-3 paragraf.
- Yumshoq CTA bilan tugating: "agar qiziqish bo'lmasa ham, xabar bering" kabi.
- Har doim JSON formatida qaytaring: {"subject": "...", "body": "..."}
- ${languageInstruction}`

  const userPrompt = `Quyidagi lidga follow-up email yozing:

Ism: ${lead.name}
Kompaniya: ${lead.company || "noma'lum"}
Soha: ${lead.industry || "noma'lum"}

${languageInstruction} Qisqa va tabiiy yozing.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Failed to parse AI response: ${raw}`)
  }

  const generated = JSON.parse(jsonMatch[0])
  return { subject: generated.subject, body: generated.body }
}
