import { NextRequest, NextResponse } from 'next/server'
import { APIError } from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import { enrichAndUpdateLead } from '@/lib/enrich'

// web_search'li qidiruv bir necha o'nlab soniya olishi mumkin.
export const maxDuration = 90

// Lid sahifasidagi qo'lda "Boyitish" tugmasi — /api/search/enrich'dan farqli
// o'laroq, bu allaqachon bazadagi (qidiruvdan yoki qo'lda qo'shilgan) lidni
// to'g'ridan-to'g'ri yangilaydi va natijani darhol qaytaradi.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = createServerClient()

  const { data: lead, error } = await db
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: 'Lid topilmadi' }, { status: 404 })
  }

  try {
    // Qo'lda bosilgan tugma — /api/search/add'dagi avtomatik fon boyitishdan
    // farqli, ko'proq qidiruv urinishiga ruxsat beriladi (max_uses=3).
    const { patch, found } = await enrichAndUpdateLead(
      db,
      {
        id: lead.id,
        name: lead.name,
        address: null,
        city: null,
        notes: lead.notes,
        email: lead.email,
        phone: lead.phone,
      },
      3,
    )

    return NextResponse.json({
      found,
      updated: patch,
      lead: { ...lead, ...patch },
    })
  } catch (err: unknown) {
    if (err instanceof APIError) {
      console.error('[leads/enrich] anthropic error:', err.status, err.message)
      return NextResponse.json({ error: err.message, code: err.error?.type }, { status: err.status ?? 500 })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[leads/enrich] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
