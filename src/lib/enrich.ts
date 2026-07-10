import Anthropic from '@anthropic-ai/sdk'
import type { createServerClient } from '@/lib/supabase'

// web_search bilan ko'p bosqichli qidiruv uzoq davom etishi mumkin — aniq
// timeout qo'yilmasa, chaqiruv Vercel function'ning umr davridan uzoqroq
// osilib qolib, hech qanday xatolik/log qoldirmasdan "yo'qolib ketishi" mumkin.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45_000 })

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

export interface EnrichedContact {
  phone: string | null
  email: string | null
  instagram: string | null
  telegram: string | null
}

// Claude'ning web_search vositasi orqali biznesning telefon/email/Instagram/Telegram
// ma'lumotlarini topadi. maxSearches xarajatni nazorat qilish uchun — masalan avtomatik
// (foydalanuvchi tugma bosmagan) boyitishda 1ga cheklanadi, qo'lda "Boyitish" tugmasida 3.
export async function enrichBusinessContact(
  { name, city, address }: { name: string; city?: string | null; address?: string | null },
  maxSearches = 3,
): Promise<EnrichedContact> {
  const systemPrompt = `Siz biznes haqida internet orqali kontakt ma'lumot qidiruvchi yordamchisiz.

Vazifa: web_search orqali berilgan biznesning rasmiy telefon raqami, email, Instagram va Telegram havolalarini toping.

Qoidalar:
- Faqat ishonchli manbalarga tayaning: biznesning rasmiy sayti, Google Maps/Google Business profili, yoki Instagram/Telegram profilining o'zi.
- Bir nechta nomdosh natija chiqsa, berilgan shahar/manzilga eng mos keladiganini tanlang.
- Biror maydonni ishonchli topa olmasangiz, uni bo'sh string ("") qoldiring — taxmin qilmang.
- Qidiruvni tugatgach, natijani albatta submit_enrichment tool orqali qaytaring.`

  const userPrompt = `Biznes: "${name}"${address ? `, manzil: ${address}` : ''}${city ? `, shahar: ${city}` : ''}.

Ushbu biznesning telefon raqami, email, Instagram va Telegram havolalarini toping.`

  const tools: Anthropic.ToolUnion[] = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches },
    SUBMIT_ENRICHMENT_TOOL,
  ]
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  let message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools,
  })

  // Uzoq davom etadigan web_search turnlari "pause_turn" bilan to'xtab qolishi
  // mumkin — bu xatolik emas, faqat davom ettirish kerakligini bildiradi.
  // Aks holda submit_enrichment tool hech qachon chaqirilmagan bo'lib chiqadi.
  let continuations = 0
  while (message.stop_reason === 'pause_turn' && continuations < 3) {
    messages.push({ role: 'assistant', content: message.content })
    message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools,
    })
    continuations++
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === 'submit_enrichment',
  )

  if (!toolUse) {
    throw new Error(`Claude qidiruv natijasini qaytarmadi (stop_reason: ${message.stop_reason})`)
  }

  const result = toolUse.input as { phone: string; email: string; instagram: string; telegram: string }

  return {
    phone: result.phone?.trim() || null,
    email: result.email?.trim() || null,
    instagram: result.instagram?.trim() || null,
    telegram: result.telegram?.trim() || null,
  }
}

// Instagram/Telegram allaqachon notes'da bo'lsa qayta yozmaydi.
export function mergeContactNotes(
  baseNotes: string | null,
  extra: { instagram: string | null; telegram: string | null },
) {
  const lines: string[] = []
  if (extra.instagram && !(baseNotes ?? '').includes('Instagram:')) lines.push(`Instagram: ${extra.instagram}`)
  if (extra.telegram && !(baseNotes ?? '').includes('Telegram:')) lines.push(`Telegram: ${extra.telegram}`)
  if (lines.length === 0) return baseNotes
  return [baseNotes, ...lines].filter(Boolean).join(' | ')
}

export interface LeadForEnrichment {
  id: string
  name: string
  address?: string | null
  city?: string | null
  notes: string | null
  email: string | null
  phone: string | null
}

// web_search orqali topilgan ma'lumot bilan lidni yangilaydi — faqat bo'sh
// maydonlar ustiga yoziladi, mavjud email/telefon almashtirilmaydi.
export async function enrichAndUpdateLead(
  db: ReturnType<typeof createServerClient>,
  lead: LeadForEnrichment,
  maxSearches: number,
): Promise<{ patch: Record<string, unknown>; found: EnrichedContact }> {
  const needsEmail = !lead.email
  const needsPhone = !lead.phone

  const found = await enrichBusinessContact({ name: lead.name, city: lead.city, address: lead.address }, maxSearches)

  const patch: Record<string, unknown> = {}
  if (needsEmail && found.email) patch.email = found.email
  if (needsPhone && found.phone) patch.phone = found.phone
  const mergedNotes = mergeContactNotes(lead.notes, found)
  if (mergedNotes !== lead.notes) patch.notes = mergedNotes

  if (Object.keys(patch).length > 0) {
    await db.from('leads').update(patch).eq('id', lead.id)
  }

  return { patch, found }
}
