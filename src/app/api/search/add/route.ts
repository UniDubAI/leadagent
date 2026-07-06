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
    results.push({ name, status: 'added' })
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await db.from('leads').insert(toInsert)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    await sendTelegramMessage(`🔎 <b>${toInsert.length} ta yangi lid qidiruvdan qo'shildi</b>`)
  }

  return NextResponse.json({ results, addedCount: toInsert.length })
}
