'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { BusinessProfile, SmmPost, SmmPostRecord } from '@/types'

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
const PLATFORM_LABELS: Record<string, string> = { instagram: 'Instagram', telegram: 'Telegram', both: 'Instagram va Telegram' }
const CONTENT_TYPE_LABELS: Record<string, string> = { single: 'Bitta post', weekly: 'Haftalik plan', launch: 'Zapusk rejasi' }

function BusinessProfileForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: BusinessProfile | null
  onSaved: (profile: BusinessProfile) => void
  onCancel?: () => void
}) {
  const [form, setForm] = useState({
    business_name: initial?.business_name ?? '',
    owner_name: initial?.owner_name ?? '',
    industry: initial?.industry ?? '',
    description: initial?.description ?? '',
    city: initial?.city ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/business-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Saqlashda xatolik yuz berdi")
      return
    }

    onSaved(await res.json())
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-line p-6">
      <h1 className="text-xl font-bold text-ink mb-1">Biznesingiz haqida ayting</h1>
      <p className="text-sm text-ink-muted mb-6">
        Bu ma&apos;lumot bir marta so&apos;raladi — keyin har safar SMM kontent shunga mos yoziladi.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            Biznes nomi <span className="text-red-500">*</span>
          </label>
          <input
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.business_name}
            onChange={set('business_name')}
            placeholder="Masalan: Sunrise Cafe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Ismingiz</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.owner_name}
            onChange={set('owner_name')}
            placeholder="Masalan: Aziz"
          />
          <p className="mt-1 text-xs text-ink-muted">
            Email imzosida &quot;Ismingiz, Biznes nomi&quot; ko&apos;rinishida ishlatiladi.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            Soha <span className="text-red-500">*</span>
          </label>
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
          <label className="block text-sm font-medium text-ink mb-1">Shahar</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.city}
            onChange={set('city')}
            placeholder="Masalan: Toshkent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Qisqa tavsif</label>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.description}
            onChange={set('description')}
            placeholder="Nima bilan shug'ullanasiz, nimasi bilan ajralib turasiz?"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-ink hover:bg-gray-50 transition"
            >
              Bekor qilish
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function PostCard({ post, index, copiedIndex, onCopy }: {
  post: SmmPost
  index: number
  copiedIndex: number | null
  onCopy: (post: SmmPost, index: number) => void
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-line p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-primary-500">{post.label}</p>
        <button
          onClick={() => onCopy(post, index)}
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
  )
}

export default function SmmPage() {
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<BusinessProfile | null | undefined>(undefined)
  const [editingProfile, setEditingProfile] = useState(false)

  const [form, setForm] = useState({
    platform: 'instagram',
    contentType: 'single',
    language: "O'zbek",
    notes: '',
    considerTrends: false,
  })

  useEffect(() => {
    const platform = searchParams.get('platform')
    const kontekst = searchParams.get('kontekst')
    if (platform === 'telegram' || platform === 'instagram' || platform === 'both') {
      setForm((prev) => ({ ...prev, platform }))
    }
    if (kontekst) {
      setForm((prev) => ({ ...prev, notes: kontekst }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [posts, setPosts] = useState<SmmPost[] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const [history, setHistory] = useState<SmmPostRecord[]>([])
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)
  const [historyCopiedKey, setHistoryCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/business-profile')
      .then((r) => r.json())
      .then((data: BusinessProfile | null) => setProfile(data))
  }, [])

  useEffect(() => {
    if (!profile) return
    fetch('/api/smm/posts')
      .then((r) => r.json())
      .then((data) => setHistory(data))
  }, [profile])

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) =>
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
    if (data.saved) setHistory((prev) => [data.saved, ...prev])
  }

  const copyPost = (post: SmmPost, index: number) => {
    navigator.clipboard.writeText(post.content)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 2000)
  }

  const copyHistoryPost = (post: SmmPost, key: string) => {
    navigator.clipboard.writeText(post.content)
    setHistoryCopiedKey(key)
    setTimeout(() => setHistoryCopiedKey((cur) => (cur === key ? null : cur)), 2000)
  }

  if (profile === undefined) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-center text-ink-muted">Yuklanmoqda...</div>
  }

  if (!profile || editingProfile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <BusinessProfileForm
          initial={profile ?? null}
          onSaved={(p) => { setProfile(p); setEditingProfile(false) }}
          onCancel={profile ? () => setEditingProfile(false) : undefined}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">SMM kontent generatsiya</h1>
          <p className="text-sm text-ink-muted mt-1">
            {profile.business_name} — {profile.industry}{profile.city ? ` — ${profile.city}` : ''}
          </p>
        </div>
        <button
          onClick={() => setEditingProfile(true)}
          className="text-sm text-primary-500 hover:text-primary-600 hover:underline shrink-0"
        >
          Tahrirlash
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-line p-6 space-y-4">
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
          <label className="block text-sm font-medium text-ink mb-1">Qo&apos;shimcha izoh (ixtiyoriy)</label>
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
            <PostCard key={index} post={post} index={index} copiedIndex={copiedIndex} onCopy={copyPost} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-ink mb-3">Oldingi generatsiyalar</h2>
          <div className="space-y-2">
            {history.map((record) => {
              const isOpen = historyOpenId === record.id
              return (
                <div key={record.id} className="bg-white rounded-xl shadow-sm border border-line overflow-hidden">
                  <button
                    onClick={() => setHistoryOpenId(isOpen ? null : record.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <span className="text-sm text-ink">
                      <span className="font-medium">{CONTENT_TYPE_LABELS[record.content_type] ?? record.content_type}</span>
                      {' · '}
                      {PLATFORM_LABELS[record.platform] ?? record.platform}
                      {' · '}
                      {new Date(record.created_at).toLocaleDateString('uz-UZ')}
                    </span>
                    <span className="text-ink-muted text-xs">{isOpen ? 'Yopish ▲' : "Ko'rish ▼"}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                      {record.posts.map((post, i) => (
                        <PostCard
                          key={i}
                          post={post}
                          index={i}
                          copiedIndex={historyCopiedKey === `${record.id}-${i}` ? i : null}
                          onCopy={(p) => copyHistoryPost(p, `${record.id}-${i}`)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
