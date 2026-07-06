import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import type { OsmSearchResult } from '@/types'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

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

function buildQuery(industry: string, city: string, limit: number) {
  const tagFilter = INDUSTRY_TAGS[industry] ?? INDUSTRY_TAGS.boshqa
  const cityEscaped = city.replace(/["\\]/g, '').trim()

  return `[out:json][timeout:25];
area["name"~"^${cityEscaped}$",i]->.searchArea;
(
  node${tagFilter}(area.searchArea);
  way${tagFilter}(area.searchArea);
);
out center ${limit};`
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
  const query = buildQuery(industry, city, cappedLimit)

  let elements: OverpassElement[]
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      return NextResponse.json({ error: `Overpass API xato qaytardi: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    elements = data.elements ?? []
  } catch (err) {
    console.error('[search] overpass error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Overpass API bilan bog'lanib bo'lmadi" }, { status: 502 })
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
      }
    })

  const results: OsmSearchResult[] = await mapWithConcurrency(businesses, 5, async (b) => {
    if (b.email || !b.website) return b
    const email = await scrapeEmail(b.website)
    return { ...b, email }
  })

  return NextResponse.json({ results })
}
