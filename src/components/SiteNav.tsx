'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/LogoutButton'
import { NavLink } from '@/components/NavLink'

export function SiteNav({ hasUser }: { hasUser: boolean }) {
  const pathname = usePathname()
  // /b/[slug] are public client-facing mini-pages — no admin chrome.
  if (pathname.startsWith('/b/')) return null

  return (
    <nav className="bg-primary-500 px-4">
      <div className="max-w-5xl mx-auto flex items-center gap-6 h-14">
        <Link href="/" className="font-bold text-white text-sm">
          LeadAgent
        </Link>
        <NavLink href="/leads">Lidlar</NavLink>
        <NavLink href="/qidiruv">Qidiruv</NavLink>
        <NavLink href="/sahifalar">Sahifalar</NavLink>
        <NavLink href="/smm">SMM</NavLink>
        <NavLink href="/leads/new">+ Yangi lid</NavLink>
        {hasUser && (
          <div className="ml-auto">
            <LogoutButton />
          </div>
        )}
      </div>
    </nav>
  )
}
