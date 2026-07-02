import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LeadAgent',
  description: 'Mijoz topish va outreach boshqaruvi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={geist.className}>
      <body className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-4">
          <div className="max-w-5xl mx-auto flex items-center gap-6 h-14">
            <Link href="/" className="font-bold text-gray-900 text-sm">
              LeadAgent
            </Link>
            <Link href="/leads" className="text-sm text-gray-600 hover:text-gray-900">
              Lidlar
            </Link>
            <Link href="/leads/new" className="text-sm text-gray-600 hover:text-gray-900">
              + Yangi lid
            </Link>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
