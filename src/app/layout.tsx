import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { getUser } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/LogoutButton'
import { NavLink } from '@/components/NavLink'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LeadAgent',
  description: 'Mijoz topish va outreach boshqaruvi',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()

  return (
    <html lang="uz" className={geist.className}>
      <body className="min-h-screen">
        <nav className="bg-primary-500 px-4">
          <div className="max-w-5xl mx-auto flex items-center gap-6 h-14">
            <Link href="/" className="font-bold text-white text-sm">
              LeadAgent
            </Link>
            <NavLink href="/leads">Lidlar</NavLink>
            <NavLink href="/qidiruv">Qidiruv</NavLink>
            <NavLink href="/smm">SMM</NavLink>
            <NavLink href="/leads/new">+ Yangi lid</NavLink>
            {user && (
              <div className="ml-auto">
                <LogoutButton />
              </div>
            )}
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
