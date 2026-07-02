import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { getUser } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/LogoutButton'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LeadAgent',
  description: 'Mijoz topish va outreach boshqaruvi',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()

  return (
    <html lang="uz" className={geist.className}>
      <body className="min-h-screen bg-gray-50">
        <nav className="bg-brand-gradient px-4">
          <div className="max-w-5xl mx-auto flex items-center gap-6 h-14">
            <Link href="/" className="font-bold text-white text-sm">
              LeadAgent
            </Link>
            <Link href="/leads" className="text-sm text-white/80 hover:text-white">
              Lidlar
            </Link>
            <Link href="/leads/new" className="text-sm text-white/80 hover:text-white">
              + Yangi lid
            </Link>
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
