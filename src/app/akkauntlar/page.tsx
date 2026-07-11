'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type {
  BusinessFinance,
  ConnectedAccount,
  InstagramAccountData,
  TelegramAccountData,
} from '@/types'
import { localeToBCP47 } from '@/i18n/config'

function fmt(n: number, locale: string) {
  return n.toLocaleString(localeToBCP47[locale as keyof typeof localeToBCP47])
}

function TelegramCard({
  account,
  onSaved,
}: {
  account: ConnectedAccount | null
  onSaved: (account: ConnectedAccount) => void
}) {
  const t = useTranslations('Accounts')
  const locale = useLocale()
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
      setError(body.error ?? t('telegramConnectError'))
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
      setError(body.error ?? t('telegramRefreshError'))
      return
    }

    onSaved(body)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-line p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-ink">💬 {t('telegramTitle')}</h2>
        {account && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary-500 hover:text-primary-600 hover:underline"
          >
            {t('connectAnother')}
          </button>
        )}
      </div>
      <p className="text-sm text-ink-muted mb-4">{t('telegramSubtitle')}</p>

      {account && !editing ? (
        <div>
          <p className="text-sm text-ink mb-1">
            <span className="font-medium">{data?.title}</span> ({account.account_name})
          </p>
          {data?.description && (
            <p className="text-sm text-ink-muted mb-1">{data.description}</p>
          )}
          <p className="text-sm text-ink-muted mb-1">
            <span className="font-medium">{t('subscribers')}:</span> {fmt(data?.members_count ?? 0, locale)}
          </p>
          <p className="text-xs text-ink-muted mb-3">
            {t('lastUpdated')}: {new Date(account.updated_at).toLocaleString(localeToBCP47[locale as keyof typeof localeToBCP47])}
          </p>
          <button
            onClick={refresh}
            disabled={connecting}
            className="text-sm px-3 py-1.5 rounded-lg font-medium bg-primary-500 hover:bg-primary-600 text-white transition disabled:opacity-50"
          >
            {connecting ? t('refreshing') : t('refreshStats')}
          </button>
        </div>
      ) : (
        <form onSubmit={connect} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('channelUsername')}</label>
            <input
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@kanal_nomi"
            />
            <p className="text-xs text-ink-muted mt-1">{t('botHint')}</p>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={connecting}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {connecting ? t('connecting') : t('connect')}
            </button>
            {account && (
              <button
                type="button"
                onClick={() => { setEditing(false); setError('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-ink hover:bg-gray-50 transition"
              >
                {t('cancel')}
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
  onDisconnected,
  notice,
}: {
  account: ConnectedAccount | null
  onDisconnected: () => void
  notice: { type: 'connected' | 'error'; reason?: string } | null
}) {
  const t = useTranslations('Accounts')
  const locale = useLocale()
  const data = account?.data as InstagramAccountData | undefined
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')

  const disconnect = async () => {
    if (!confirm(t('instagramDisconnectConfirm'))) return
    setDisconnecting(true)
    setError('')

    const res = await fetch('/api/accounts/instagram', { method: 'DELETE' })

    setDisconnecting(false)

    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? t('instagramDisconnectError'))
      return
    }

    onDisconnected()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-line p-6">
      <h2 className="font-semibold text-ink mb-1">📸 {t('instagramTitle')}</h2>
      <p className="text-sm text-ink-muted mb-4">{t('instagramSubtitle')}</p>

      {notice?.type === 'connected' && (
        <p className="text-sm text-primary-500 mb-3">{t('instagramConnectedNotice')}</p>
      )}
      {notice?.type === 'error' && (
        <p className="text-sm text-red-600 mb-3">{notice.reason || t('instagramConnectError')}</p>
      )}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {account ? (
        <div>
          <p className="text-sm text-ink mb-1">
            <span className="font-medium">@{account.account_name}</span>
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <p className="text-sm text-ink-muted">
              <span className="font-medium">{t('subscribers')}:</span> {fmt(data?.followers ?? 0, locale)}
            </p>
            <p className="text-sm text-ink-muted">
              <span className="font-medium">{t('postsLast30d')}:</span> {fmt(data?.posts_last_30d ?? 0, locale)}
            </p>
            <p className="text-sm text-ink-muted">
              <span className="font-medium">{t('avgLikes')}:</span> {fmt(data?.avg_likes ?? 0, locale)}
            </p>
            <p className="text-sm text-ink-muted">
              <span className="font-medium">{t('avgViews')}:</span> {fmt(data?.avg_views ?? 0, locale)}
            </p>
          </div>
          <p className="text-xs text-ink-muted mb-3">
            {t('lastUpdated')}: {new Date(account.updated_at).toLocaleString(localeToBCP47[locale as keyof typeof localeToBCP47])}
          </p>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="text-sm px-3 py-1.5 rounded-lg font-medium border border-gray-300 text-ink hover:bg-gray-50 transition disabled:opacity-50"
          >
            {disconnecting ? t('disconnecting') : t('disconnect')}
          </button>
        </div>
      ) : (
        <div>
          <a
            href="/api/accounts/instagram/connect"
            className="inline-block bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {t('instagramConnect')}
          </a>
          <p className="text-xs text-ink-muted mt-3">{t('instagramHelp')}</p>
        </div>
      )}
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
  const t = useTranslations('Accounts')
  const locale = useLocale()
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
      setError(body.error ?? t('financeSaveError'))
      return
    }

    onSaved(body)
    setSaved(true)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-line p-6">
      <h2 className="font-semibold text-ink mb-1">💰 {t('financeTitle')}</h2>
      <p className="text-sm text-ink-muted mb-4">{t('financeSubtitle')}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('monthlyRevenue')}</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.monthly_revenue}
              onChange={set('monthly_revenue')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('monthlyExpense')}</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.monthly_expense}
              onChange={set('monthly_expense')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('avgReceipt')}</label>
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
            {t('estimatedProfit')}:{' '}
            <span className={`font-medium ${profit >= 0 ? 'text-ink' : 'text-red-600'}`}>
              {t('currencyAmount', { amount: fmt(profit, locale) })}
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
            {saving ? t('saving') : t('save')}
          </button>
          {saved && <span className="text-sm text-primary-500">{t('saved')}</span>}
        </div>
      </form>
    </div>
  )
}

function AkkauntlarPageInner() {
  const t = useTranslations('Accounts')
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<ConnectedAccount[] | undefined>(undefined)
  const [finance, setFinance] = useState<BusinessFinance | null | undefined>(undefined)
  const [loadError, setLoadError] = useState('')

  const instagramStatus = searchParams.get('instagram')
  const instagramNotice = instagramStatus === 'connected' || instagramStatus === 'error'
    ? { type: instagramStatus as 'connected' | 'error', reason: searchParams.get('reason') ?? undefined }
    : null

  useEffect(() => {
    fetch('/api/accounts').then(async (r) => {
      const body = await r.json()
      if (!r.ok) {
        setLoadError(body.error ?? t('loadError'))
        setAccounts([])
        return
      }
      setAccounts(body)
    })
    fetch('/api/finance').then(async (r) => {
      const body = await r.json()
      if (!r.ok) {
        setLoadError(body.error ?? t('loadError'))
        setFinance(null)
        return
      }
      setFinance(body)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const upsertAccount = (account: ConnectedAccount) => {
    setAccounts((prev) => {
      const rest = (prev ?? []).filter((a) => a.platform !== account.platform)
      return [...rest, account]
    })
  }

  const removeAccount = (platform: ConnectedAccount['platform']) => {
    setAccounts((prev) => (prev ?? []).filter((a) => a.platform !== platform))
  }

  if (accounts === undefined || finance === undefined) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-center text-ink-muted">{t('loading')}</div>
  }

  const telegramAccount = accounts.find((a) => a.platform === 'telegram') ?? null
  const instagramAccount = accounts.find((a) => a.platform === 'instagram') ?? null

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

      <TelegramCard account={telegramAccount} onSaved={upsertAccount} />
      <InstagramCard
        account={instagramAccount}
        onDisconnected={() => removeAccount('instagram')}
        notice={instagramNotice}
      />
      <FinanceCard finance={finance} onSaved={setFinance} />
    </div>
  )
}

export default function AkkauntlarPage() {
  return (
    <Suspense>
      <AkkauntlarPageInner />
    </Suspense>
  )
}
