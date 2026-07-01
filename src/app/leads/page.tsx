'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Lead, LeadStatus } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'

const STATUSES = [
  { value: '', label: 'Barchasi' },
  { value: 'new', label: 'Yangi' },
  { value: 'contacted', label: 'Murojaat' },
  { value: 'replied', label: 'Javob berdi' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed_won', label: 'Yutildi' },
  { value: 'closed_lost', label: 'Yutqazildi' },
]

const INDUSTRIES = ['Restoran', "Go'zallik saloni", "Do'kon", 'Fitnes', "Ta'lim", 'Boshqa']

export default function LeadsPage() {
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
        <h1 className="text-2xl font-bold text-gray-900">Lidlar</h1>
        <Link
          href="/leads/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Yangi lid
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Ism yoki kompaniya bo'yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Barcha sohalar</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>

        {(search || statusFilter || industryFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setIndustryFilter('') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Tozalash
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Yuklanmoqda...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">{leads.length === 0 ? 'Lidlar topilmadi' : 'Filtr bo\'yicha natija yo\'q'}</p>
          {leads.length === 0 && (
            <Link href="/leads/new" className="text-blue-600 hover:underline text-sm">
              Birinchi lidni qo'shing
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-400">
            {filtered.length} ta lid{filtered.length !== leads.length && ` (jami ${leads.length} dan)`}
          </div>
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ism</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kompaniya</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Soha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Telefon</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Manba</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Til</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => (window.location.href = `/leads/${lead.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.company ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.source ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.message_language ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status as LeadStatus} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString('uz-UZ')}
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
