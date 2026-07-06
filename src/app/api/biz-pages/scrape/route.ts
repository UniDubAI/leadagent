import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { website } = await req.json()
  if (!website) {
    return NextResponse.json({ error: 'website talab qilinadi' }, { status: 400 })
  }

  const url = /^https?:\/\//i.test(website) ? website : `https://${website}`

  let html: string
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return NextResponse.json({ error: `Sayt xato qaytardi: ${res.status}` }, { status: 502 })
    html = await res.text()
  } catch (err) {
    console.error('[biz-pages/scrape] fetch error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Saytga ulanib bo'lmadi" }, { status: 502 })
  }

  const instagram = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/i)?.[0] ?? null
  const telegram = html.match(/https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_]+/i)?.[0] ?? null
  const facebook = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-]+/i)?.[0] ?? null

  const mailto = html.match(/mailto:([^"'?\s>]+)/i)
  const email = mailto
    ? decodeURIComponent(mailto[1])
    : html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? null

  return NextResponse.json({ instagram, telegram, facebook, email })
}
