'use client'

import { useEffect, useState } from 'react'
import type {
  BusinessFinance,
  ConnectedAccount,
  InstagramAccountData,
  TelegramAccountData,
} from '@/types'

function fmt(n: number) {
  return n.toLocaleString('uz-UZ')
}

function TelegramCard({
  account,
  onSaved,
}: {
  account: ConnectedAccount | null
  onSaved: (account: ConnectedAccount) => void
}) {
  const [username, setUsername] = useState('')
  const [editing, setEditing] = useState(!account)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const data = account?.data as TelegramAccountData | undefined

  const connect = async (e: React.FormEvent) => {
    e.preventDefault()
    setConnecting(true)
    setError('')

    const res = await fetch('/api/accounts/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username || account?.account_name }),
    })
    const body = await res.json()

    setConnecting(false)

    if (!res.ok) {
      setError(body.error ?? 'Ulanishda xatolik yuz berdi')
      return
    }

    onSaved(body)
    setEditing(false)
    setUsername('')
  }

  const refresh = async () => {
    if (!account) return
    setConnecting(true)
    setError('')

    const res = await fetch('/api/accounts/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.account_name }),
    })
    const body = await res.json()

    setConnecting(false)

    if (!res.ok) {
      setError(body.error ?? 'Yangilashda xatolik yuz berdi')
      return
    }

    onSaved(body)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-line p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-ink">💬 Telegram kanal</h2>
        {account && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary-500 hover:text-primary-600 hover:underline"
          >
            Boshqa kanal ulash
          </button>
        )}
      </div>
      <p className="text-sm text-ink-muted mb-4">
        @leadagent_notify_bot orqali kanalingizning ochiq statistikasi olinadi.
      </p>

      {account && !editing ? (
        <div>
          <p className="text-sm text-ink mb-1">
            <span className="font-medium">{data?.title}</span> ({account.account_name})
          </p>
          {data?.description && (
            <p className="text-sm text-ink-muted mb-1">{data.description}</p>
          )}
          <p className="text-sm text-ink-muted mb-1">
            <span className="font-medium">Obunachilar:</span> {fmt(data?.members_count ?? 0)}
          </p>
          <p className="text-xs text-ink-muted mb-3">
            Oxirgi yangilanish: {new Date(account.updated_at).toLocaleString('uz-UZ')}
          </p>
          <button
            onClick={refresh}
            disabled={connecting}
            className="text-sm px-3 py-1.5 rounded-lg font-medium bg-primary-500 hover:bg-primary-600 text-white transition disabled:opacity-50"
          >
            {connecting ? 'Yangilanmoqda...' : 'Statistikani yangilash'}
          </button>
        </div>
      ) : (
        <form onSubmit={connect} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Kanal username</label>
            <input
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@kanal_nomi"
            />
            <p className="text-xs text-ink-muted mt-1">
              Botni kanalingizga administrator sifatida qo&apos;shing: @leadagent_notify_bot
            </p>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={connecting}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {connecting ? 'Ulanmoqda...' : 'Ulash'}
            </button>
            {account && (
              <button
                type="button"
                onClick={() => { setEditing(false); setError('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-ink hover:bg-gray-50 transition"
              >
                Bekor qilish
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

function InstagramCard({
  account,
  onSaved,
}: {
  account: ConnectedAccount | null
  onSaved: (account: ConnectedAccount) => void
}) {
  const data = account?.data as InstagramAccountData | undefined

  const [form, setForm] = useState({
    username: account?.account_name ?? '',
    followers: data?.followers?.toString() ?? '',
    posts_last_30d: data?.posts_last_30d?.toString() ?? '',
    avg_likes: data?.avg_likes?.toString() ?? '',
    avg_views: data?.avg_views?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false)
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/accounts/instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const body = await res.json()

    setSaving(false)

    if (!res.ok) {
      setError(body.error ?? 'Saqlashda xatolik yuz berdi')
      return
    }

    onSaved(body)
    setSaved(true)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-line p-6">
      <h2 className="font-semibold text-ink mb-1">📸 Instagram</h2>
      <p className="text-sm text-ink-muted mb-4">
        Instagram API ishlatilmaydi — raqamlarni qo&apos;lda kiriting, istalgan payt yangilashingiz mumkin.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Username</label>
          <input
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.username}
            onChange={set('username')}
            placeholder="@biznes_nomi"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Obunachilar</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.followers}
              onChange={set('followers')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Postlar (30 kun)</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.posts_last_30d}
              onChange={set('posts_last_30d')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">O&apos;rtacha like</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.avg_likes}
              onChange={set('avg_likes')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">O&apos;rtacha ko&apos;rish</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.avg_views}
              onChange={set('avg_views')}
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
          {saved && <span className="text-sm text-primary-500">Saqlandi ✓</span>}
          {account && (
            <span className="text-xs text-ink-muted ml-auto">
              Oxirgi yangilanish: {new Date(account.updated_at).toLocaleString('uz-UZ')}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

function FinanceCard({
  finance,
  onSaved,
}: {
  finance: BusinessFinance | null
  onSaved: (finance: BusinessFinance) => void
}) {
  const [form, setForm] = useState({
    monthly_revenue: finance?.monthly_revenue?.toString() ?? '',
    monthly_expense: finance?.monthly_expense?.toString() ?? '',
    avg_receipt: finance?.avg_receipt?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false)
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const profit = Number(form.monthly_revenue) - Number(form.monthly_expense)
  const showProfit = form.monthly_revenue !== '' && form.monthly_expense !== ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const body = await res.json()

    setSaving(false)

    if (!res.ok) {
      setError(body.error ?? 'Saqlashda xatolik yuz berdi')
      return
    }

    onSaved(body)
    setSaved(true)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-line p-6">
      <h2 className="font-semibold text-ink mb-1">💰 Moliya</h2>
      <p className="text-sm text-ink-muted mb-4">
        Oylik raqamlarni qo&apos;lda kiriting — tavsiyalar shu asosda ham beriladi.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Oylik daromad (so&apos;m)</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.monthly_revenue}
              onChange={set('monthly_revenue')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Oylik xarajat (so&apos;m)</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.monthly_expense}
              onChange={set('monthly_expense')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">O&apos;rtacha chek (so&apos;m)</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.avg_receipt}
              onChange={set('avg_receipt')}
            />
          </div>
        </div>

        {showProfit && (
          <p className="text-sm text-ink-muted">
            Taxminiy oylik foyda:{' '}
            <span className={`font-medium ${profit >= 0 ? 'text-ink' : 'text-red-600'}`}>
              {fmt(profit)} so&apos;m
            </span>
          </p>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
          {saved && <span className="text-sm text-primary-500">Saqlandi ✓</span>}
        </div>
      </form>
    </div>
  )
}

export default function AkkauntlarPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[] | undefined>(undefined)
  const [finance, setFinance] = useState<BusinessFinance | null | undefined>(undefined)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/api/accounts').then(async (r) => {
      const body = await r.json()
      if (!r.ok) {
        setLoadError(body.error ?? "Ma'lumotlarni yuklashda xatolik yuz berdi")
        setAccounts([])
        return
      }
      setAccounts(body)
    })
    fetch('/api/finance').then(async (r) => {
      const body = await r.json()
      if (!r.ok) {
        setLoadError(body.error ?? "Ma'lumotlarni yuklashda xatolik yuz berdi")
        setFinance(null)
        return
      }
      setFinance(body)
    })
  }, [])

  const upsertAccount = (account: ConnectedAccount) => {
    setAccounts((prev) => {
      const rest = (prev ?? []).filter((a) => a.platform !== account.platform)
      return [...rest, account]
    })
  }

  if (accounts === undefined || finance === undefined) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-center text-ink-muted">Yuklanmoqda...</div>
  }

  const telegramAccount = accounts.find((a) => a.platform === 'telegram') ?? null
  const instagramAccount = accounts.find((a) => a.platform === 'instagram') ?? null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Akkauntlar</h1>
        <p className="text-sm text-ink-muted mt-1">
          Ijtimoiy tarmoq va moliya ma&apos;lumotlarini ulang — bular &quot;Tavsiyalar&quot; bo&apos;limida to&apos;liq biznes audit uchun ishlatiladi.
        </p>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Ma&apos;lumotlarni yuklashda xatolik: {loadError}
        </div>
      )}

      <TelegramCard account={telegramAccount} onSaved={upsertAccount} />
      <InstagramCard account={instagramAccount} onSaved={upsertAccount} />
      <FinanceCard finance={finance} onSaved={setFinance} />
    </div>
  )
}
