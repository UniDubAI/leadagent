'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

// Bu qiymatlar DB'da erkin matn sifatida saqlanadi va boshqa joylarda
// (masalan xabar tili -> outreach generatsiya prompti) aynan shu ko'rinishda
// solishtiriladi -- shuning uchun tarjima qilinmaydi.
const INDUSTRY_OPTIONS = ['Restoran', "Go'zallik saloni", "Do'kon", 'Fitnes', "Ta'lim", 'Boshqa']
const LANGUAGE_OPTIONS = ["O'zbek", 'Rus', 'Ingliz']
const SOURCE_OPTIONS = ['Instagram', 'LinkedIn', 'Google Maps', 'Telegram', 'Boshqa']

export default function NewLeadPage() {
  const t = useTranslations('LeadNew')
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    linkedin_url: '',
    phone: '',
    industry: '',
    message_language: '',
    source: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? t('genericError'))
      setSaving(false)
      return
    }

    const lead = await res.json()
    router.push(`/leads/${lead.id}`)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-6">{t('title')}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-line p-6 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            {t('name')} <span className="text-red-500">*</span>
          </label>
          <input
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.name}
            onChange={set('name')}
            placeholder="John Smith"
          />
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('company')}</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.company}
            onChange={set('company')}
            placeholder="Acme Corp"
          />
        </div>

        {/* Industry */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('industry')}</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            value={form.industry}
            onChange={set('industry')}
          >
            <option value="">{t('select')}</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('email')}</label>
          <input
            type="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.email}
            onChange={set('email')}
            placeholder="john@acme.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('phone')}</label>
          <input
            type="tel"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.phone}
            onChange={set('phone')}
            placeholder="+998 90 123 45 67"
          />
        </div>

        {/* LinkedIn */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('linkedinUrl')}</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.linkedin_url}
            onChange={set('linkedin_url')}
            placeholder="https://linkedin.com/in/..."
          />
        </div>

        {/* Source */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('source')}</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            value={form.source}
            onChange={set('source')}
          >
            <option value="">{t('select')}</option>
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Message language */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('messageLanguage')}</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            value={form.message_language}
            onChange={set('message_language')}
          >
            <option value="">{t('select')}</option>
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('notes')}</label>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.notes}
            onChange={set('notes')}
            placeholder={t('notesPlaceholder')}
          />
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
