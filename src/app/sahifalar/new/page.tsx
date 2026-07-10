'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Lead, BizReview } from '@/types'
import { slugify } from '@/lib/slug'

function extractWebsiteFromNotes(notes: string | null): string {
  if (!notes) return ''
  const parts = notes.split('|').map((p) => p.trim())
  const websitePart = parts.find((p) => /^(https?:\/\/)?[\w-]+\.[a-z]{2,}(\/\S*)?$/i.test(p))
  return websitePart ?? ''
}

export default function NewBizPage() {
  const t = useTranslations('PageNew')
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    business_name: '',
    slug: '',
    tagline: '',
    phone: '',
    address: '',
    instagram: '',
    telegram: '',
    facebook: '',
    website: '',
    menu_url: '',
    working_hours: '',
  })
  const [reviews, setReviews] = useState<BizReview[]>([])

  useEffect(() => {
    fetch('/api/leads').then((r) => r.json()).then(setLeads)
  }, [])

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'business_name' && !slugTouched) {
      setForm((prev) => ({ ...prev, business_name: value, slug: slugify(value) }))
    }
  }

  const setSlug = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugTouched(true)
    setForm((prev) => ({ ...prev, slug: e.target.value }))
  }

  const handleLeadSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const leadId = e.target.value
    setSelectedLeadId(leadId)
    if (!leadId) return

    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    const businessName = lead.company || lead.name
    setForm((prev) => ({
      ...prev,
      business_name: businessName,
      slug: slugTouched ? prev.slug : slugify(businessName),
      phone: lead.phone ?? prev.phone,
      website: extractWebsiteFromNotes(lead.notes) || prev.website,
    }))
  }

  const handleScrape = async () => {
    if (!form.website) return
    setScraping(true)
    setScrapeError('')

    try {
      const res = await fetch('/api/biz-pages/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: form.website }),
      })
      const data = await res.json()
      if (!res.ok) {
        setScrapeError(data.error ?? t('scrapeError'))
        return
      }
      setForm((prev) => ({
        ...prev,
        instagram: data.instagram || prev.instagram,
        telegram: data.telegram || prev.telegram,
        facebook: data.facebook || prev.facebook,
      }))
    } finally {
      setScraping(false)
    }
  }

  const addReview = () => setReviews((prev) => [...prev, { author: '', text: '' }])
  const removeReview = (i: number) => setReviews((prev) => prev.filter((_, idx) => idx !== i))
  const setReview = (i: number, field: keyof BizReview) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setReviews((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: e.target.value } : r)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/biz-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, reviews, lead_id: selectedLeadId || null }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? t('genericError'))
      setSaving(false)
      return
    }

    router.push('/sahifalar')
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-6">{t('title')}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-line p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('fillFromLead')}</label>
          <select value={selectedLeadId} onChange={handleLeadSelect} className={`${inputClass} bg-white`}>
            <option value="">{t('notSelected')}</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>{l.company || l.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            {t('businessName')} <span className="text-red-500">*</span>
          </label>
          <input required className={inputClass} value={form.business_name} onChange={set('business_name')} placeholder="Sunrise Cafe" />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('slug')}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">/b/</span>
            <input className={inputClass} value={form.slug} onChange={setSlug} placeholder="sunrise-cafe" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('tagline')}</label>
          <input className={inputClass} value={form.tagline} onChange={set('tagline')} placeholder={t('taglinePlaceholder')} />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('phone')}</label>
          <input type="tel" className={inputClass} value={form.phone} onChange={set('phone')} placeholder="+998 90 123 45 67" />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('address')}</label>
          <input className={inputClass} value={form.address} onChange={set('address')} placeholder={t('addressPlaceholder')} />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('website')}</label>
          <div className="flex gap-2">
            <input className={inputClass} value={form.website} onChange={set('website')} placeholder="example.uz" />
            <button
              type="button"
              onClick={handleScrape}
              disabled={!form.website || scraping}
              className="whitespace-nowrap bg-white hover:bg-primary-500 text-primary-500 hover:text-white border border-primary-500 px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-50"
            >
              {scraping ? t('scraping') : t('scrapeFromWebsite')}
            </button>
          </div>
          {scrapeError && <p className="text-xs text-red-600 mt-1">{scrapeError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Instagram</label>
          <input className={inputClass} value={form.instagram} onChange={set('instagram')} placeholder="https://instagram.com/..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Telegram</label>
          <input className={inputClass} value={form.telegram} onChange={set('telegram')} placeholder="https://t.me/..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Facebook</label>
          <input className={inputClass} value={form.facebook} onChange={set('facebook')} placeholder="https://facebook.com/..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('menu')}</label>
          <input className={inputClass} value={form.menu_url} onChange={set('menu_url')} placeholder="https://..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('workingHours')}</label>
          <textarea rows={2} className={inputClass} value={form.working_hours} onChange={set('working_hours')} placeholder={t('workingHoursPlaceholder')} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-ink">{t('reviews')}</label>
            <button type="button" onClick={addReview} className="text-xs text-primary-500 hover:underline">
              {t('addReview')}
            </button>
          </div>
          <div className="space-y-3">
            {reviews.map((review, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={review.author}
                    onChange={setReview(i, 'author')}
                    placeholder={t('authorName')}
                  />
                  <button type="button" onClick={() => removeReview(i)} className="text-xs text-red-500 hover:underline whitespace-nowrap">
                    {t('delete')}
                  </button>
                </div>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={review.text}
                  onChange={setReview(i, 'text')}
                  placeholder={t('reviewText')}
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? t('saving') : t('save')}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-ink-muted hover:bg-gray-50 hover:border-primary-500"
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
