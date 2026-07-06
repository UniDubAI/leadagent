import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { getUser } from '@/lib/supabase/server'
import { SiteNav } from '@/components/SiteNav'

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
        <SiteNav hasUser={Boolean(user)} />
        <main>{children}</main>
      </body>
    </html>
  )
}
