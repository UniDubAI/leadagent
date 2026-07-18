'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Lead, LeadStatus } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { localeToBCP47 } from '@/i18n/config'

const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'replied', 'qualified', 'closed_won', 'closed_lost']
const STALE_STATUSES: LeadStatus[] = ['new', 'contacted']
const STALE_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_BAR_HEIGHT = 120

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const t = useTranslations('Home')
  const locale = useLocale()
  const weekdays = t.raw('weekdays') as string[]
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    fetch('/api/leads')
      .then((r) => r.json())
      .then((data) => { setLeads(data); setLoading(false) })
  }, [])

  const countByStatus = (status: LeadStatus) => leads.filter((l) => l.status === status).length
  const recent = leads.slice(0, 5)

  const emailsSent = leads.filter((l) => l.email_sent_at).length
  const closedWon = countByStatus('closed_won')
  const conversionRate = leads.length > 0 ? Math.round((closedWon / leads.length) * 100) : 0

  const last7Days = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (6 - i))
      const key = dateKey(d)
      const count = leads.filter((l) => dateKey(new Date(l.created_at)) === key).length
      return { key, label: weekdays[d.getDay()], date: d.toLocaleDateString(localeToBCP47[locale as keyof typeof localeToBCP47], { day: '2-digit', month: '2-digit' }), count }
    })
  }, [leads, weekdays, locale])

  const maxDayCount = Math.max(1, ...last7Days.map((d) => d.count))

  const staleLeads = useMemo(() => {
    return leads
      .filter((l) => STALE_STATUSES.includes(l.status) && l.last_contact_at)
      .map((l) => ({ lead: l, days: Math.floor((now - new Date(l.last_contact_at!).getTime()) / DAY_MS) }))
      .filter(({ days }) => days >= STALE_DAYS)
      .sort((a, b) => b.days - a.days)
  }, [leads, now])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">LeadAgent</h1>
          <p className="text-ink-muted text-sm">{t('tagline')}</p>
        </div>
        <Link
          href="/leads/new"
          className="bg-white hover:bg-primary-500 text-primary-500 hover:text-white border-2 border-primary-500 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          {t('newLead')}
        </Link>
      </div>

      {!loading && leads.length === 0 && (
        <div className="bg-white rounded-xl border-2 border-primary-500 p-6 mb-8">
          <h2 className="text-lg font-semibold text-ink mb-2">{t('welcomeTitle')}</h2>
          <p className="text-sm text-ink-muted mb-4">{t('welcomeBody')}</p>
          <Link
            href="/leads/new"
            className="inline-block bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {t('welcomeCta')}
          </Link>
        </div>
      )}

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-line shadow-sm p-4">
          <p className="text-sm text-ink-muted">{t('totalLeads')}</p>
          <p className="text-3xl font-bold text-primary-500 mt-1">{loading ? '—' : leads.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-line shadow-sm p-4">
          <p className="text-sm text-ink-muted">{t('emailsSent')}</p>
          <p className="text-3xl font-bold text-primary-500 mt-1">{loading ? '—' : emailsSent}</p>
        </div>
        <div className="bg-white rounded-xl border border-line shadow-sm p-4">
          <p className="text-sm text-ink-muted">{t('conversion')}</p>
          <p className="text-3xl font-bold text-primary-500 mt-1">{loading ? '—' : `${conversionRate}%`}</p>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        {STATUS_ORDER.map((status) => (
          <Link
            key={status}
            href={`/leads?status=${status}`}
            className="bg-white rounded-xl border border-line p-4 hover:border-primary-500 hover:shadow-sm transition text-center"
          >
            <p className="text-2xl font-bold text-primary-500">{loading ? '—' : countByStatus(status)}</p>
            <div className="mt-1 flex justify-center">
              <StatusBadge status={status} />
            </div>
          </Link>
        ))}
      </div>

      {/* Last 7 days */}
      <div className="bg-white rounded-xl shadow-sm border border-line p-5 mb-8">
        <h2 className="font-semibold text-ink mb-4">{t('last7Days')}</h2>
        {loading ? (
          <div className="text-center py-6 text-ink-muted">{t('loading')}</div>
        ) : (
          <div className="flex items-end justify-between gap-2">
            {last7Days.map((day) => {
              const barHeight = Math.max(4, Math.round((day.count / maxDayCount) * MAX_BAR_HEIGHT))
              return (
                <div key={day.key} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full flex flex-col items-center justify-end gap-1"
                    style={{ height: MAX_BAR_HEIGHT }}
                  >
                    <span className="text-xs font-medium text-ink">{day.count}</span>
                    <div
                      className={`w-full rounded-t-md ${day.count === 0 ? 'bg-gray-200' : 'bg-primary-500'}`}
                      style={{ height: barHeight }}
                      title={t('leadsCount', { count: day.count })}
                    />
                  </div>
                  <p className="text-[11px] text-ink-muted">{day.label} {day.date}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Needs attention */}
      <div className="bg-white rounded-xl shadow-sm border border-line mb-8">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-ink">{t('needsAttention')}</h2>
          <p className="text-xs text-ink-muted mt-0.5">{t('needsAttentionSubtitle')}</p>
        </div>
        {loading ? (
          <div className="text-center py-10 text-ink-muted">{t('loading')}</div>
        ) : staleLeads.length === 0 ? (
          <div className="text-center py-10 text-ink-muted">{t('allClear')}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {staleLeads.map(({ lead, days }) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{lead.name}</p>
                  <p className="text-xs text-ink-muted">{lead.company ?? '—'}</p>
                </div>
                <span className="text-xs font-medium text-primary-500 bg-white border border-primary-500 px-2.5 py-1 rounded-full">
                  {t('daysAgo', { days })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent leads */}
      <div className="bg-white rounded-xl shadow-sm border border-line">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-ink">{t('recentLeads')}</h2>
          <Link href="/leads" className="text-sm text-primary-500 hover:text-primary-600 hover:underline">{t('viewAll')}</Link>
        </div>

        {loading ? (
          <div className="text-center py-10 text-ink-muted">{t('loading')}</div>
        ) : recent.length === 0 ? (
          <div className="text-center py-10 text-ink-muted">
            {t('noLeadsYet')}{' '}
            <Link href="/leads/new" className="text-primary-500 hover:text-primary-600 hover:underline">{t('addOne')}</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{lead.name}</p>
                  <p className="text-xs text-ink-muted">{lead.company ?? '—'}</p>
                </div>
                <StatusBadge status={lead.status as LeadStatus} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
