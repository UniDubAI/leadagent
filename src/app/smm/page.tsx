'use client'

import { useState } from 'react'
import type { SmmPost } from '@/types'

const INDUSTRY_OPTIONS = ['Restoran', "Go'zallik", 'Avto', "Ta'lim", "Do'kon", 'Boshqa']
const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'both', label: 'Ikkalasi' },
]
const CONTENT_TYPE_OPTIONS = [
  { value: 'single', label: 'Bitta post' },
  { value: 'weekly', label: 'Haftalik kontent-plan (7 post)' },
  { value: 'launch', label: 'Zapusk rejasi' },
]
const LANGUAGE_OPTIONS = ["O'zbek", 'Rus']

export default function SmmPage() {
  const [form, setForm] = useState({
    businessName: '',
    industry: '',
    platform: 'instagram',
    contentType: 'single',
    language: "O'zbek",
    notes: '',
    considerTrends: false,
  })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [posts, setPosts] = useState<SmmPost[] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError('')
    setPosts(null)

    const res = await fetch('/api/smm/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setGenerating(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Generatsiyada xatolik yuz berdi')
      return
    }

    const data = await res.json()
    setPosts(data.posts)
  }

  const copyPost = (post: SmmPost, index: number) => {
    navigator.clipboard.writeText(post.content)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-6">SMM kontent generatsiya</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-line p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            Biznes nomi <span className="text-red-500">*</span>
          </label>
          <input
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.businessName}
            onChange={set('businessName')}
            placeholder="Masalan: Sunrise Cafe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Soha</label>
          <select
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            value={form.industry}
            onChange={set('industry')}
          >
            <option value="">— Tanlang —</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Platforma</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            value={form.platform}
            onChange={set('platform')}
          >
            {PLATFORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Kontent turi</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            value={form.contentType}
            onChange={set('contentType')}
          >
            {CONTENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Til</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            value={form.language}
            onChange={set('language')}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Qo&apos;shimcha izoh</label>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.notes}
            onChange={set('notes')}
            placeholder="Masalan: yangi menyu chiqdi, hafta oxiri aksiya bor..."
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.considerTrends}
            onChange={(e) => setForm((prev) => ({ ...prev, considerTrends: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-ink">Dolzarb trendlarni hisobga ol</span>
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={generating}
          className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          {generating
            ? form.considerTrends
              ? 'Trendlar qidirilmoqda...'
              : 'AI yozmoqda...'
            : 'Generatsiya qilish'}
        </button>
      </form>

      {posts && posts.length > 0 && (
        <div className="mt-6 space-y-4">
          {posts.map((post, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-line p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-primary-500">{post.label}</p>
                <button
                  onClick={() => copyPost(post, index)}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                    copiedIndex === index
                      ? 'bg-white border border-primary-500 text-primary-500'
                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }`}
                >
                  {copiedIndex === index ? 'Nusxalandi ✓' : 'Nusxalash'}
                </button>
              </div>
              <pre className="text-sm text-ink whitespace-pre-wrap font-sans">{post.content}</pre>
              {post.trend_basis && (
                <p className="mt-2 text-xs text-ink-muted">Trend: {post.trend_basis}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
