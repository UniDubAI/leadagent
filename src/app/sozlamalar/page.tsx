'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { OutreachTone, UserSettings } from '@/types'

const TONES: OutreachTone[] = ['formal', 'neutral', 'friendly']

const DEFAULT_FORM = {
  outreach_tone: 'neutral' as OutreachTone,
  followup_delay_days: '3',
  followup_max_count: '1',
  signature: '',
}

export default function SozlamalarPage() {
  const t = useTranslations('Settings')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(async (r) => {
      const body: UserSettings | null = await r.json()
      if (!r.ok) {
        setLoadError((body as unknown as { error?: string })?.error ?? t('loadError'))
        setLoading(false)
        return
      }
      if (body) {
        setForm({
          outreach_tone: body.outreach_tone,
          followup_delay_days: String(body.followup_delay_days),
          followup_max_count: String(body.followup_max_count),
          signature: body.signature ?? '',
        })
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outreach_tone: form.outreach_tone,
        followup_delay_days: Number(form.followup_delay_days),
        followup_max_count: Number(form.followup_max_count),
        signature: form.signature,
      }),
    })
    const body = await res.json()

    setSaving(false)

    if (!res.ok) {
      setError(body.error ?? t('saveError'))
      return
    }

    setSaved(true)
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-center text-ink-muted">{t('loading')}</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="text-sm text-ink-muted mt-1">{t('subtitle')}</p>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {t('loadError')}: {loadError}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-line p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('outreachTone')}</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              value={form.outreach_tone}
              onChange={(e) => {
                setSaved(false)
                setForm((prev) => ({ ...prev, outreach_tone: e.target.value as OutreachTone }))
              }}
            >
              {TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {t(`tone_${tone}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">{t('followupDelayDays')}</label>
              <input
                type="number"
                min={1}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.followup_delay_days}
                onChange={(e) => {
                  setSaved(false)
                  setForm((prev) => ({ ...prev, followup_delay_days: e.target.value }))
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">{t('followupMaxCount')}</label>
              <input
                type="number"
                min={0}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.followup_max_count}
                onChange={(e) => {
                  setSaved(false)
                  setForm((prev) => ({ ...prev, followup_max_count: e.target.value }))
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('signature')}</label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.signature}
              onChange={(e) => {
                setSaved(false)
                setForm((prev) => ({ ...prev, signature: e.target.value }))
              }}
              placeholder={t('signaturePlaceholder')}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {saving ? t('saving') : t('save')}
            </button>
            {saved && <span className="text-sm text-primary-500">{t('saved')}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
