import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServerClient()
  const { data, error } = await db
    .from('business_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { business_name, owner_name, industry, description, city } = await req.json()

  if (!business_name || !industry) {
    return NextResponse.json({ error: 'business_name va industry talab qilinadi' }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('business_profiles')
    .upsert(
      {
        user_id: user.id,
        business_name,
        owner_name: owner_name || null,
        industry,
        description: description || null,
        city: city || null,
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
