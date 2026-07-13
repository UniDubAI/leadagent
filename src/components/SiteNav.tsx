'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LogoutButton } from '@/components/LogoutButton'
import { NavLink } from '@/components/NavLink'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function SiteNav({ hasUser }: { hasUser: boolean }) {
  const pathname = usePathname()
  const t = useTranslations('Nav')
  // /b/[slug] are public client-facing mini-pages — no admin chrome.
  if (pathname.startsWith('/b/')) return null

  return (
    <nav className="bg-primary-500 px-4">
      <div className="max-w-5xl mx-auto flex items-center gap-6 h-14">
        <Link href="/" className="font-bold text-white text-sm">
          LeadAgent
        </Link>
        <NavLink href="/leads">{t('leads')}</NavLink>
        <NavLink href="/qidiruv">{t('search')}</NavLink>
        <NavLink href="/sahifalar">{t('pages')}</NavLink>
        <NavLink href="/smm">{t('smm')}</NavLink>
        <NavLink href="/tavsiyalar">{t('recommendations')}</NavLink>
        <NavLink href="/akkauntlar">{t('accounts')}</NavLink>
        <NavLink href="/sozlamalar">{t('settings')}</NavLink>
        <NavLink href="/leads/new">{t('newLead')}</NavLink>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher />
          {hasUser && <LogoutButton />}
        </div>
      </div>
    </nav>
  )
}
