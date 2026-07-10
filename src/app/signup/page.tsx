'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const t = useTranslations('Signup')
  const tAuth = useTranslations('Auth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setLoading(false)
      setError(error.message === 'User already registered'
        ? t('alreadyRegistered')
        : t('genericError'))
      return
    }

    if (data.session) {
      // Email confirmation off — session is live immediately, dashboard loads empty.
      window.location.href = '/'
      return
    }

    // Email confirmation on — no session yet, ask the user to confirm first.
    setConfirmSent(true)
    setLoading(false)
  }

  if (confirmSent) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <div className="bg-white rounded-xl shadow-sm border border-line p-6 text-center">
          <h1 className="text-xl font-bold text-ink mb-2">{t('checkEmailTitle')}</h1>
          <p className="text-sm text-ink-muted mb-4">
            {t('checkEmailBody', { email })}
          </p>
          <Link href="/login" className="text-primary-500 hover:text-primary-600 hover:underline text-sm">
            {t('goToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="bg-white rounded-xl shadow-sm border border-line p-6">
        <h1 className="text-xl font-bold text-ink mb-6">{t('title')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">{tAuth('email')}</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">{tAuth('password')}</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? t('submitting') : t('submit')}
          </button>
        </form>
        <p className="text-sm text-ink-muted mt-4 text-center">
          {t('haveAccount')}{' '}
          <Link href="/login" className="text-primary-500 hover:text-primary-600 hover:underline">
            {t('loginLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}
