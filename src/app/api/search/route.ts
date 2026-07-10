import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import type { OsmSearchResult } from '@/types'

// Overpass'ning bepul umumiy serverlari ko'pincha band bo'lib 504/429
// qaytaradi. Har biri bitta marta sinaladi, biri ishlamasa keyingisiga o'tiladi.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

// OSM amenity/shop teglariga moslashtirilgan soha xaritasi.
const INDUSTRY_TAGS: Record<string, string> = {
  restoran: '["amenity"~"^(restaurant|cafe|fast_food|bar)$"]',
  gozallik: '["shop"~"^(hairdresser|beauty|massage)$"]',
  dokon: '["shop"]',
  fitnes: '["leisure"~"^(fitness_centre|sports_centre)$"]',
  talim: '["amenity"~"^(language_school|driving_school|music_school|college)$"]',
  boshqa: '["office"]',
}

type OverpassElement = { tags?: Record<string, string> }
type BBox = { south: number; north: number; west: number; east: number }

// Shahar nomini area["name"=...] orqali Overpass ichida qidirish OSM'dagi
// haqiqiy tegga (masalan Toshkent -> "Toshkent shahri") qat'iy mos kelishni
// talab qiladi, regex+harflar katta-kichikligini hisobga olmasdan qidirish
// esa butun bazani skanerlab timeout beradi. Shu sabab shahar birinchi
// navbatda Nominatim orqali geokodlanadi, keyin Overpass'ga faqat bitta
// tezkor bbox so'rovi yuboriladi.
async function geocodeCity(city: string): Promise<BBox | null> {
  const url = `${NOMINATIM_URL}?city=${encodeURIComponent(city)}&format=json&limit=1`
  const res = await fetch(url, { headers: { 'User-Agent': 'LeadAgent-Search/1.0' } })
  if (!res.ok) {
    console.error('[search] nominatim error:', res.status, await res.text())
    return null
  }

  const data = await res.json()
  const bbox = data?.[0]?.boundingbox
  if (!bbox) return null

  const [south, north, west, east] = bbox.map(Number)
  return { south, north, west, east }
}

function buildQuery(industry: string, bbox: BBox, limit: number) {
  const tagFilter = INDUSTRY_TAGS[industry] ?? INDUSTRY_TAGS.boshqa
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`

  return `[out:json][timeout:50];
(
  node${tagFilter}(${bboxStr});
  way${tagFilter}(${bboxStr});
);
out center ${limit};`
}

// Mirrorlarni navbat bilan sinaydi (har biriga 30s, jami bitta o'tish).
// 429/504 yoki tarmoq xatosida keyingi mirrorga o'tadi; hammasi muvaffaqiyatsiz
// bo'lsa, chaqiruvchi tarafda foydalanuvchiga tushunarli xabar ko'rsatiladi.
async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  let lastError = 'Overpass mirrorlari javob bermadi'

  for (const url of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30000)
      const res = await fetch(url, {
        method: 'POST',
        // Overpass-api.de returns 406 for requests without a User-Agent header
        // (Node's fetch sends none by default, unlike curl/browsers).
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'LeadAgent-Search/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const body = await res.text()
        lastError = `${url} -> HTTP ${res.status}`
        console.error('[search] overpass mirror failed:', lastError, body.slice(0, 500))
        continue
      }

      const data = await res.json()
      if (data.remark) {
        lastError = `${url} -> remark: ${data.remark}`
        console.error('[search] overpass mirror remark:', lastError)
        continue
      }

      return data.elements ?? []
    } catch (err) {
      lastError = `${url} -> ${err instanceof Error ? err.message : String(err)}`
      console.error('[search] overpass mirror unreachable:', lastError)
    }
  }

  throw new Error(lastError)
}

function formatAddress(tags: Record<string, string>) {
  const parts = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean)
  return parts.length ? parts.join(' ') : (tags['addr:full'] ?? null)
}

async function scrapeEmail(website: string): Promise<string | null> {
  try {
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null

    const html = await res.text()
    const mailto = html.match(/mailto:([^"'?\s>]+)/i)
    if (mailto) return decodeURIComponent(mailto[1])

    const match = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    return match ? match[0] : null
  } catch {
    return null
  }
}

// Sayt fetchlarini bir nechta parallel ishchi bilan cheklaydi — Overpass'ga
// bitta so'rov ketadi, lekin natijadagi o'nlab saytlarni ketma-ket kutish sekin.
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { industry, city, limit } = await req.json()
  if (!industry || !city) {
    return NextResponse.json({ error: "Soha va shahar talab qilinadi" }, { status: 400 })
  }

  const cappedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50)

  let bbox: BBox | null
  try {
    bbox = await geocodeCity(city)
  } catch (err) {
    console.error('[search] geocode error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Shahar joylashuvini aniqlab bo'lmadi" }, { status: 502 })
  }
  if (!bbox) {
    return NextResponse.json({ error: `"${city}" shahri topilmadi` }, { status: 404 })
  }

  const query = buildQuery(industry, bbox, cappedLimit)

  let elements: OverpassElement[]
  try {
    elements = await fetchOverpass(query)
  } catch (err) {
    console.error('[search] all overpass mirrors failed:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: "Qidiruv serveri hozir band, 1-2 daqiqadan keyin qayta urinib ko'ring" },
      { status: 503 },
    )
  }

  const businesses = elements
    .filter((el) => el.tags?.name)
    .map((el) => {
      const tags = el.tags!
      return {
        name: tags.name,
        address: formatAddress(tags),
        phone: tags.phone ?? tags['contact:phone'] ?? null,
        website: tags.website ?? tags['contact:website'] ?? null,
        email: tags.email ?? tags['contact:email'] ?? null,
        opening_hours: tags.opening_hours ?? null,
      }
    })

  const scraped = await mapWithConcurrency(businesses, 5, async (b) => {
    if (b.email || !b.website) return b
    const email = await scrapeEmail(b.website)
    return { ...b, email }
  })

  // Flag results that match a lead already in this user's base (by name or
  // email) so the UI can show "Qo'shilgan" and skip them up front, instead
  // of only discovering the duplicate after the user clicks to add it.
  const db = createServerClient()
  const { data: existing, error: existingError } = await db
    .from('leads')
    .select('id, name, email')
    .eq('user_id', user.id)
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

  const idByName = new Map(existing.map((l) => [l.name.trim().toLowerCase(), l.id]))
  const idByEmail = new Map(existing.filter((l) => l.email).map((l) => [l.email!.trim().toLowerCase(), l.id]))

  const results: OsmSearchResult[] = scraped.map((b) => {
    const leadId = idByName.get(b.name.trim().toLowerCase()) ?? (b.email ? idByEmail.get(b.email.trim().toLowerCase()) : undefined)
    return {
      ...b,
      already_added: !!leadId,
      lead_id: leadId ?? null,
    }
  })

  return NextResponse.json({ results })
}
