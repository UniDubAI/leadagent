'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { locales, localeLabels } from '@/i18n/config'
import { setLocale } from '@/i18n/actions'

export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations('Nav')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    startTransition(async () => {
      await setLocale(next)
      router.refresh()
    })
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      disabled={pending}
      aria-label={t('language')}
      className="bg-primary-500 text-white text-xs border border-white/30 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-white/60 disabled:opacity-50"
    >
      {locales.map((l) => (
        <option key={l} value={l} className="text-ink">
          {localeLabels[l]}
        </option>
      ))}
    </select>
  )
}
