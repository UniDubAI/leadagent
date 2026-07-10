'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Lead, LeadStatus } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { localeToBCP47 } from '@/i18n/config'

const STATUS_VALUES: LeadStatus[] = ['new', 'contacted', 'replied', 'qualified', 'closed_won', 'closed_lost']

// Lead.industry DB'da erkin matn (masalan "Restoran") sifatida saqlanadi —
// filtr qiymatlari shu saqlangan matn bilan aynan mos kelishi kerak,
// shuning uchun bu ro'yxat tarjima qilinmaydi.
const INDUSTRIES = ['Restoran', "Go'zallik saloni", "Do'kon", 'Fitnes', "Ta'lim", 'Boshqa']

export default function LeadsPage() {
  const t = useTranslations('Leads')
  const tStatus = useTranslations('StatusBadge')
  const locale = useLocale()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/leads')
      .then((r) => r.json())
      .then((data) => { setLeads(data); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter((lead) => {
      if (q && !lead.name.toLowerCase().includes(q) && !(lead.company ?? '').toLowerCase().includes(q)) return false
      if (statusFilter && lead.status !== statusFilter) return false
      if (industryFilter && lead.industry !== industryFilter) return false
      return true
    })
  }, [leads, search, statusFilter, industryFilter])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <Link
          href="/leads/new"
          className="bg-white hover:bg-primary-500 text-primary-500 hover:text-white border-2 border-primary-500 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          {t('newLead')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('allStatuses')}</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>{tStatus(s)}</option>
          ))}
        </select>

        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('allIndustries')}</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>

        {(search || statusFilter || industryFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setIndustryFilter('') }}
            className="px-3 py-2 text-sm text-ink-muted hover:text-ink border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('clear')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-ink-muted">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-lg mb-2">{leads.length === 0 ? t('noLeadsFound') : t('noResultsForFilter')}</p>
          {leads.length === 0 && (
            <Link href="/leads/new" className="text-primary-500 hover:text-primary-600 hover:underline text-sm">
              {t('addFirstLead')}
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-line overflow-hidden overflow-x-auto">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-ink-muted">
            {filtered.length === leads.length
              ? t('countFiltered', { count: filtered.length })
              : t('countOfTotal', { count: filtered.length, total: leads.length })}
          </div>
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('name')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('company')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('industry')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('phone')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('email')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('source')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('language')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('status')}</th>
                <th className="text-left px-4 py-3 font-medium text-ink-muted">{t('date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => (window.location.href = `/leads/${lead.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-ink">{lead.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{lead.company ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{lead.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{lead.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{lead.email ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{lead.source ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{lead.message_language ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status as LeadStatus} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(lead.created_at).toLocaleDateString(localeToBCP47[locale as keyof typeof localeToBCP47])}
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
