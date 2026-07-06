import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import type { BizPage } from '@/types'

function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="block w-full text-center border-2 border-[#f5ead9] text-[#f5ead9] rounded-full py-3 px-4 font-medium hover:bg-[#f5ead9] hover:text-[#4a2c1a] transition"
    >
      {children}
    </a>
  )
}

export default async function BizPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const db = createServerClient()
  const { data: page } = await db.from('biz_pages').select('*').eq('slug', slug).maybeSingle<BizPage>()

  if (!page) notFound()

  const mapsHref = page.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(page.address)}`
    : null

  return (
    <div className="min-h-screen bg-[#4a2c1a] text-[#f5ead9] flex justify-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col items-center">
        <h1 className="text-2xl font-bold text-center mb-1">{page.business_name}</h1>
        {page.tagline && <p className="text-center text-[#e0cdb8] mb-6">{page.tagline}</p>}
        {!page.tagline && <div className="mb-6" />}

        <div className="w-full space-y-3">
          {page.menu_url && <Button href={page.menu_url}>📋 Menyu</Button>}
          {page.instagram && <Button href={page.instagram}>📷 Instagram</Button>}
          {page.telegram && <Button href={page.telegram}>✈️ Telegram</Button>}
          {page.facebook && <Button href={page.facebook}>📘 Facebook</Button>}
          {page.website && <Button href={page.website}>🌐 Veb-sayt</Button>}
          {page.phone && <Button href={`tel:${page.phone.replace(/\s+/g, '')}`}>📞 Qo&apos;ng&apos;iroq qilish</Button>}
          {mapsHref && <Button href={mapsHref}>📍 Manzil</Button>}
        </div>

        {page.working_hours && (
          <div className="w-full mt-8 text-center">
            <h2 className="text-sm uppercase tracking-wide text-[#e0cdb8] mb-2">Ish vaqti</h2>
            <p className="whitespace-pre-line">{page.working_hours}</p>
          </div>
        )}

        {page.reviews.length > 0 && (
          <div className="w-full mt-8">
            <h2 className="text-sm uppercase tracking-wide text-[#e0cdb8] mb-3 text-center">Mijozlar fikri</h2>
            <div className="space-y-3">
              {page.reviews.slice(0, 3).map((review, i) => (
                <div key={i} className="border border-[#6b4a35] rounded-xl p-4">
                  <p className="text-sm mb-2">&ldquo;{review.text}&rdquo;</p>
                  <p className="text-xs text-[#e0cdb8]">— {review.author}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
