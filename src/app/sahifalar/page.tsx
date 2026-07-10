'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import type { BizPage } from '@/types'
import { localeToBCP47 } from '@/i18n/config'

export default function SahifalarPage() {
  const t = useTranslations('Pages')
  const locale = useLocale()
  const [pages, setPages] = useState<BizPage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/biz-pages')
      .then((r) => r.json())
      .then((data) => { setPages(data); setLoading(false) })
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <Link
          href="/sahifalar/new"
          className="bg-white hover:bg-primary-500 text-primary-500 hover:text-white border-2 border-primary-500 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          {t('newPage')}
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-16 text-ink-muted">{t('loading')}</div>
      ) : pages.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-lg mb-2">{t('noPagesYet')}</p>
          <Link href="/sahifalar/new" className="text-primary-500 hover:text-primary-600 hover:underline text-sm">
            {t('createFirst')}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-line overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('businessName')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('link')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('date')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink">{page.business_name}</td>
                  <td className="px-4 py-3 text-ink-muted">/b/{page.slug}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(page.created_at).toLocaleDateString(localeToBCP47[locale as keyof typeof localeToBCP47])}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/b/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 hover:underline"
                    >
                      {t('view')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
