import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import './globals.css'
import { getUser } from '@/lib/supabase/server'
import { SiteNav } from '@/components/SiteNav'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LeadAgent',
  description: 'Mijoz topish va outreach boshqaruvi',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, locale] = await Promise.all([getUser(), getLocale()])

  return (
    <html lang={locale} className={geist.className}>
      <body className="min-h-screen">
        <NextIntlClientProvider>
          <SiteNav hasUser={Boolean(user)} />
          <main>{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
