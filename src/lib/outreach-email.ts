import Anthropic from '@anthropic-ai/sdk'
import type { Lead, OutreachTone } from '@/types'

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

// Foydalanuvchi sozlamalaridagi outreach_tone bo'yicha promptga qo'shiladigan
// ohang ko'rsatmasi. 'neutral' — hozirgi (sozlamalar qo'shilishidan oldingi)
// standart matn, shuning uchun sozlama tanlanmagan foydalanuvchilar uchun
// xatti-harakat o'zgarmaydi.
export const TONE_INSTRUCTION: Record<OutreachTone, string> = {
  formal: 'Rasmiy, hurmatli ohangda yozing — "Siz" murojaati, so\'zlashuv uslubidan saqlaning.',
  neutral: 'Oddiy, insoniy ohangda yozing.',
  friendly: "Do'stona, iliq va samimiy ohangda yozing, lekin professionallikni saqlang.",
}

// Generatsiya qilingan xabar oxiriga foydalanuvchining o'z imzosini qo'shadi
// (agar sozlamada belgilangan bo'lsa). AI promptiga ishonish o'rniga
// deterministik append — imzo matni har doim aniq va o'zgarishsiz chiqadi.
export function appendSignature(body: string, signature?: string | null): string {
  const trimmed = signature?.trim()
  return trimmed ? `${body}\n\n${trimmed}` : body
}

type FollowupLead = Pick<Lead, 'name' | 'company' | 'industry' | 'message_language'>

// Email imzosini "Ism, Kompaniya" ko'rinishida quradi. owner_name bo'sh bo'lsa
// faqat biznes nomi, u ham bo'lmasa email prefiksi ishlatiladi.
export function buildSignerName(
  profile: { owner_name?: string | null; business_name?: string | null } | null | undefined,
  fallbackEmail?: string | null,
): string {
  const ownerName = profile?.owner_name?.trim()
  const businessName = profile?.business_name?.trim()

  if (ownerName && businessName) return `${ownerName}, ${businessName}`
  if (businessName) return businessName
  if (ownerName) return ownerName
  return fallbackEmail?.split('@')[0] || 'Bizning jamoa'
}

// Lidning avvalgi kontaktidan 3+ kun o'tgach, cron orqali avtomatik yuboriladigan
// follow-up email matnini generatsiya qiladi. Cold outreach'dan farqli o'laroq,
// bu allaqachon bir marta yozilgan lidga "eslatma" ohangida bo'ladi.
export async function generateFollowupEmail(
  lead: FollowupLead,
  signerName = 'Bizning jamoa',
  tone: OutreachTone = 'neutral',
  signature?: string | null,
): Promise<{ subject: string; body: string }> {
  const language = LANG_MAP[lead.message_language ?? ''] ?? 'Uzbek'
  const languageInstruction = LANG_INSTRUCTION_MAP[language]
  const toneInstruction = TONE_INSTRUCTION[tone]

  const systemPrompt = `Siz B2B savdo mutaxassisisiz. Vazifangiz: bir necha kun oldin birinchi marta yozilgan, lekin javob kelmagan mijozga qisqa follow-up (eslatma) email yozish.

MAJBURIY TIL QOIDASI: ${languageInstruction} Boshqa tilda birorta so'z ham yozmang — bu qoida hamma narsadan ustun.

Qoidalar:
- Bu birinchi email emas, eslatma — "yana bir bor yozyapman" ohangida, lekin bosim o'tkazmasdan.
- Reklama tilida YOZMANG. ${toneInstruction}
- Juda qisqa: 2-3 paragraf.
- Yumshoq CTA bilan tugating: "agar qiziqish bo'lmasa ham, xabar bering" kabi.
- Email oxirida imzo qo'ying va imzo sifatida ANIQ "${signerName}" nomini yozing (masalan "Hurmat bilan, ${signerName}" yoki tilga mos analogi).
- Matnda HECH QACHON kvadrat qavsli placeholder ("[Ismingiz]", "[Your Name]", "[Ваше имя]" va h.k.) qoldirmang — barcha joylar to'liq va tayyor matn bo'lsin.
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
  return { subject: generated.subject, body: appendSignature(generated.body, signature) }
}
