import { NextRequest, NextResponse } from 'next/server'
import { APIError } from '@anthropic-ai/sdk'
import { getUser } from '@/lib/supabase/server'
import { enrichBusinessContact } from '@/lib/enrich'

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, city, address } = await req.json()
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: "Biznes nomi kiritilmadi" }, { status: 400 })
    }

    const result = await enrichBusinessContact({ name, city, address }, 3)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof APIError) {
      console.error('[search/enrich] anthropic error:', err.status, err.message)
      return NextResponse.json({ error: err.message, code: err.error?.type }, { status: err.status ?? 500 })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[search/enrich] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
