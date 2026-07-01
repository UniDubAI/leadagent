'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Lead, LeadStatus } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'

const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'replied', 'qualified', 'closed_won', 'closed_lost']

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leads')
      .then((r) => r.json())
      .then((data) => { setLeads(data); setLoading(false) })
  }, [])

  const countByStatus = (status: LeadStatus) => leads.filter((l) => l.status === status).length
  const recent = leads.slice(0, 5)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LeadAgent</h1>
          <p className="text-gray-500 text-sm">Mijoz topish va outreach boshqaruvi</p>
        </div>
        <Link
          href="/leads/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Yangi lid
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        {STATUS_ORDER.map((status) => (
          <Link
            key={status}
            href={`/leads?status=${status}`}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow text-center"
          >
            <p className="text-2xl font-bold text-gray-900">{loading ? '—' : countByStatus(status)}</p>
            <div className="mt-1 flex justify-center">
              <StatusBadge status={status} />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent leads */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">So'nggi lidlar</h2>
          <Link href="/leads" className="text-sm text-blue-600 hover:underline">Barchasi →</Link>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Yuklanmoqda...</div>
        ) : recent.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            Hali lid yo'q.{' '}
            <Link href="/leads/new" className="text-blue-600 hover:underline">Qo'shing</Link>
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
                  <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.company ?? '—'}</p>
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
