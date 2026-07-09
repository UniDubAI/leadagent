import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServerClient()
  const { data, error } = await db
    .from('business_finances')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { monthly_revenue, monthly_expense, avg_receipt } = await req.json()

  const toNumberOrNull = (v: unknown) => {
    if (v === '' || v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('business_finances')
    .upsert(
      {
        user_id: user.id,
        monthly_revenue: toNumberOrNull(monthly_revenue),
        monthly_expense: toNumberOrNull(monthly_expense),
        avg_receipt: toNumberOrNull(avg_receipt),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
