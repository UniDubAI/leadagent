import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import { slugify } from '@/lib/slug'
import type { BizReview } from '@/types'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServerClient()
  const { data, error } = await db
    .from('biz_pages')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Bir xil nomdagi sahifalar bo'lishi mumkin — slug band bo'lsa -2, -3
// qo'shib avtomatik ravishda unikal qilinadi.
async function uniqueSlug(db: ReturnType<typeof createServerClient>, base: string) {
  let candidate = base
  let suffix = 2
  while (true) {
    const { data } = await db.from('biz_pages').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${suffix}`
    suffix++
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    business_name, tagline, phone, address, instagram, telegram, facebook,
    website, menu_url, working_hours, reviews, theme, lead_id, slug,
  } = body

  if (!business_name) {
    return NextResponse.json({ error: 'business_name talab qilinadi' }, { status: 400 })
  }

  const db = createServerClient()
  const baseSlug = slugify(slug || business_name)
  const finalSlug = await uniqueSlug(db, baseSlug)

  const { data, error } = await db
    .from('biz_pages')
    .insert({
      user_id: user.id,
      slug: finalSlug,
      business_name,
      tagline: tagline || null,
      phone: phone || null,
      address: address || null,
      instagram: instagram || null,
      telegram: telegram || null,
      facebook: facebook || null,
      website: website || null,
      menu_url: menu_url || null,
      working_hours: working_hours || null,
      reviews: (reviews as BizReview[] | undefined)?.filter((r) => r.author || r.text) ?? [],
      theme: theme || 'brown',
      lead_id: lead_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
