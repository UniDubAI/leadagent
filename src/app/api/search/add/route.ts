import { NextRequest, NextResponse, after } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'
import { enrichAndUpdateLead } from '@/lib/enrich'

// web_search'li boyitish bir necha o'nlab soniya olishi mumkin — after()
// fon vazifasi ham shu route'ning maxDuration byudjeti ichida ishlaydi.
export const maxDuration = 120

interface IncomingLead {
  name?: string
  phone?: string | null
  email?: string | null
  address?: string | null
  website?: string | null
  opening_hours?: string | null
  instagram?: string | null
  telegram?: string | null
  industry?: string | null
  city?: string | null
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildTelegramMessage(added: IncomingLead[]) {
  if (added.length === 1) {
    const lead = added[0]
    return [
      "🔍 <b>Qidiruvdan yangi lid:</b>",
      `📌 ${escapeHtml(lead.name!)}`,
      `📞 ${lead.phone ? escapeHtml(lead.phone) : '—'}`,
      `📧 ${lead.email ? escapeHtml(lead.email) : '—'}`,
      `🌐 ${lead.website ? escapeHtml(lead.website) : '—'}`,
      `📂 ${lead.industry ? escapeHtml(lead.industry) : '—'}`,
    ].join('\n')
  }

  const lines = added.map((lead, i) => {
    const contact = lead.phone ?? lead.email ?? '—'
    return `${i + 1}. ${escapeHtml(lead.name!)} — ${escapeHtml(contact)}`
  })
  return [`🔍 <b>${added.length} ta yangi lid qidiruvdan:</b>`, ...lines].join('\n')
}

// Qidiruvdan qo'shilgan, lekin email yoki telefoni yetishmayotgan lidni fonda
// avtomatik boyitadi — bitta lid uchun atigi bitta web_search chaqiruvi bilan
// (xarajat nazorati), natija bo'sh bo'lsa qayta urinilmaydi.
async function autoEnrichLead(
  db: ReturnType<typeof createServerClient>,
  lead: {
    id: string
    name: string
    address: string | null
    city: string | null
    notes: string | null
    email: string | null
    phone: string | null
  },
) {
  try {
    const { patch } = await enrichAndUpdateLead(db, lead, 1)
    const hasEmailNow = Boolean(lead.email || patch.email)
    await sendTelegramMessage(
      `✨ Lid boyitildi: ${lead.name} — email ${hasEmailNow ? 'topildi' : 'topilmadi'}`,
    )
  } catch (err) {
    console.error(
      '[search/add] auto-enrich error for lead',
      lead.id,
      err instanceof Error ? err.message : err,
    )
    await sendTelegramMessage(`⚠️ Lid boyitib bo'lmadi: ${lead.name} (xatolik yuz berdi)`)
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leads } = (await req.json()) as { leads?: IncomingLead[] }
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "leads massivi talab qilinadi" }, { status: 400 })
  }

  const db = createServerClient()
  const { data: existing, error: fetchError } = await db
    .from('leads')
    .select('id, name, email')
    .eq('user_id', user.id)
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const idByName = new Map(existing.map((l) => [l.name.trim().toLowerCase(), l.id]))
  const idByEmail = new Map(
    existing.filter((l) => l.email).map((l) => [l.email!.trim().toLowerCase(), l.id]),
  )
  // Bir xil so'rovdagi (hali DB'ga yozilmagan) qatorlar orasidagi dublikatlarni
  // aniqlash uchun — idByName/idByEmail faqat DB'da allaqachon bor lidlarni bildiradi.
  const seenNames = new Set<string>()
  const seenEmails = new Set<string>()

  const results: Array<{ name: string; status: 'added' | 'duplicate'; lead_id: string | null }> = []
  const addedDetails: IncomingLead[] = []
  const toInsert: Array<{
    user_id: string
    name: string
    phone: string | null
    email: string | null
    industry: string | null
    notes: string | null
    source: string
    status: string
  }> = []
  // toInsert bilan bir xil tartibda — enrichment uchun address/city saqlab boriladi.
  const enrichContext: Array<{ address: string | null; city: string | null }> = []

  for (const lead of leads) {
    const name = String(lead.name ?? '').trim()
    if (!name) continue
    const email = lead.email ? String(lead.email).trim() : null
    const emailKey = email?.toLowerCase()
    const nameKey = name.toLowerCase()

    const isDuplicate =
      idByName.has(nameKey) ||
      seenNames.has(nameKey) ||
      (emailKey ? idByEmail.has(emailKey) || seenEmails.has(emailKey) : false)

    if (isDuplicate) {
      const duplicateId = idByName.get(nameKey) ?? (emailKey ? idByEmail.get(emailKey) : undefined) ?? null
      results.push({ name, status: 'duplicate', lead_id: duplicateId })
      continue
    }

    seenNames.add(nameKey)
    if (emailKey) seenEmails.add(emailKey)

    toInsert.push({
      user_id: user.id,
      name,
      phone: lead.phone ?? null,
      email,
      industry: lead.industry ?? null,
      notes: [
        lead.address ? `Manzil: ${lead.address}` : null,
        lead.website ? `Sayt: ${lead.website}` : null,
        lead.opening_hours ? `Ish vaqti: ${lead.opening_hours}` : null,
        lead.instagram ? `Instagram: ${lead.instagram}` : null,
        lead.telegram ? `Telegram: ${lead.telegram}` : null,
      ].filter(Boolean).join(' | ') || null,
      source: `OSM qidiruv (${new Date().toISOString().slice(0, 10)})`,
      status: 'new',
    })
    enrichContext.push({ address: lead.address ?? null, city: lead.city ?? null })
    addedDetails.push({ ...lead, name, email })
    results.push({ name, status: 'added', lead_id: null })
  }

  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await db.from('leads').insert(toInsert).select('id')
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Postgres INSERT ... VALUES ... RETURNING inserted qatorlarni xuddi shu
    // tartibda qaytaradi — shuning uchun toInsert bilan indeks bo'yicha moslashadi.
    let insertedIndex = 0
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'added') {
        results[i].lead_id = inserted[insertedIndex].id
        insertedIndex++
      }
    }

    await sendTelegramMessage(buildTelegramMessage(addedDetails))

    for (let i = 0; i < toInsert.length; i++) {
      const row = toInsert[i]
      const ctx = enrichContext[i]
      const needsEmail = !row.email
      const needsPhone = !row.phone
      if (!needsEmail && !needsPhone) continue

      const leadId = inserted[i].id
      after(() =>
        autoEnrichLead(db, {
          id: leadId,
          name: row.name,
          address: ctx.address,
          city: ctx.city,
          notes: row.notes,
          email: row.email,
          phone: row.phone,
        }),
      )
    }
  }

  return NextResponse.json({ results, addedCount: toInsert.length })
}
