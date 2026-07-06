import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'

interface IncomingLead {
  name?: string
  phone?: string | null
  email?: string | null
  address?: string | null
  website?: string | null
  industry?: string | null
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

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leads } = (await req.json()) as { leads?: IncomingLead[] }
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "leads massivi talab qilinadi" }, { status: 400 })
  }

  const db = createServerClient()
  const { data: existing, error: fetchError } = await db.from('leads').select('name, email')
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const existingNames = new Set(existing.map((l) => l.name.trim().toLowerCase()))
  const existingEmails = new Set(
    existing.filter((l) => l.email).map((l) => l.email!.trim().toLowerCase()),
  )

  const results: Array<{ name: string; status: 'added' | 'duplicate' }> = []
  const addedDetails: IncomingLead[] = []
  const toInsert: Array<{
    name: string
    phone: string | null
    email: string | null
    industry: string | null
    notes: string | null
    source: string
    status: string
  }> = []

  for (const lead of leads) {
    const name = String(lead.name ?? '').trim()
    if (!name) continue
    const email = lead.email ? String(lead.email).trim() : null
    const emailKey = email?.toLowerCase()

    const isDuplicate = existingNames.has(name.toLowerCase()) || (emailKey && existingEmails.has(emailKey))
    if (isDuplicate) {
      results.push({ name, status: 'duplicate' })
      continue
    }

    existingNames.add(name.toLowerCase())
    if (emailKey) existingEmails.add(emailKey)

    toInsert.push({
      name,
      phone: lead.phone ?? null,
      email,
      industry: lead.industry ?? null,
      notes: [lead.address, lead.website].filter(Boolean).join(' | ') || null,
      source: 'OSM qidiruv',
      status: 'new',
    })
    addedDetails.push({ ...lead, name, email })
    results.push({ name, status: 'added' })
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await db.from('leads').insert(toInsert)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    await sendTelegramMessage(buildTelegramMessage(addedDetails))
  }

  return NextResponse.json({ results, addedCount: toInsert.length })
}
