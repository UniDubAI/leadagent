'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { OsmSearchResult } from '@/types'

// Label'lar leads/page.tsx dagi INDUSTRIES ro'yxati bilan bir xil bo'lishi
// kerak — shunda qidiruvdan qo'shilgan lid Lidlar sahifasidagi soha filtriga tushadi.
const SEARCH_INDUSTRIES = [
  { value: 'restoran', label: 'Restoran' },
  { value: 'gozallik', label: "Go'zallik saloni" },
  { value: 'dokon', label: "Do'kon" },
  { value: 'fitnes', label: 'Fitnes' },
  { value: 'talim', label: "Ta'lim" },
  { value: 'boshqa', label: 'Boshqa' },
]

type RowStatus = 'idle' | 'adding' | 'added' | 'duplicate'
type EnrichStatus = 'idle' | 'loading' | 'done' | 'error'

export default function QidiruvPage() {
  const [industry, setIndustry] = useState('restoran')
  const [city, setCity] = useState('Toshkent')
  const [limit, setLimit] = useState(20)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<OsmSearchResult[] | null>(null)
  const [rowStatus, setRowStatus] = useState<Record<number, RowStatus>>({})
  const [rowLeadId, setRowLeadId] = useState<Record<number, string>>({})
  const [addingAll, setAddingAll] = useState(false)
  const [searchedCity, setSearchedCity] = useState('')
  const [enrichStatus, setEnrichStatus] = useState<Record<number, EnrichStatus>>({})
  const [enrichError, setEnrichError] = useState<Record<number, string>>({})

  const industryLabel = SEARCH_INDUSTRIES.find((opt) => opt.value === industry)?.label ?? 'Boshqa'

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearching(true)
    setError('')
    setResults(null)
    setRowStatus({})
    setRowLeadId({})

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, city, limit }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Qidiruvda xatolik yuz berdi')
        return
      }
      setResults(data.results)
      setSearchedCity(city)
      const initialStatus: Record<number, RowStatus> = {}
      const initialLeadId: Record<number, string> = {}
      data.results.forEach((r: OsmSearchResult, i: number) => {
        if (r.already_added) initialStatus[i] = 'duplicate'
        if (r.lead_id) initialLeadId[i] = r.lead_id
      })
      setRowStatus(initialStatus)
      setRowLeadId(initialLeadId)
    } finally {
      setSearching(false)
    }
  }

  const addLeads = async (indices: number[]) => {
    if (!results || indices.length === 0) return

    setRowStatus((prev) => {
      const next = { ...prev }
      indices.forEach((i) => { next[i] = 'adding' })
      return next
    })

    const payload = indices.map((i) => ({ ...results[i], industry: industryLabel, city: searchedCity }))
    const res = await fetch('/api/search/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: payload }),
    })
    const data = await res.json()

    setRowStatus((prev) => {
      const next = { ...prev }
      indices.forEach((i, j) => {
        next[i] = data.results?.[j]?.status === 'duplicate' ? 'duplicate' : 'added'
      })
      return next
    })
    setRowLeadId((prev) => {
      const next = { ...prev }
      indices.forEach((i, j) => {
        const leadId = data.results?.[j]?.lead_id
        if (leadId) next[i] = leadId
      })
      return next
    })
  }

  const handleAddAll = async () => {
    if (!results) return
    setAddingAll(true)
    const idle = results.map((_, i) => i).filter((i) => !rowStatus[i] || rowStatus[i] === 'idle')
    await addLeads(idle)
    setAddingAll(false)
  }

  const enrichRow = async (i: number) => {
    if (!results) return
    const r = results[i]

    setEnrichStatus((prev) => ({ ...prev, [i]: 'loading' }))
    setEnrichError((prev) => {
      const next = { ...prev }
      delete next[i]
      return next
    })

    const res = await fetch('/api/search/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: r.name, city: searchedCity, address: r.address }),
    })
    const data = await res.json()

    if (!res.ok) {
      setEnrichStatus((prev) => ({ ...prev, [i]: 'error' }))
      setEnrichError((prev) => ({ ...prev, [i]: data.error ?? 'Boyitishda xatolik yuz berdi' }))
      return
    }

    setResults((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next[i] = {
        ...next[i],
        phone: next[i].phone || data.phone,
        email: next[i].email || data.email,
        instagram: data.instagram || next[i].instagram,
        telegram: data.telegram || next[i].telegram,
      }
      return next
    })
    setEnrichStatus((prev) => ({ ...prev, [i]: 'done' }))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-6">Lid qidirish</h1>

      <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-sm border border-line p-6 space-y-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Soha</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SEARCH_INDUSTRIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Shahar</label>
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Natija soni</label>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={searching}
          className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          {searching ? 'Qidirilmoqda...' : 'Qidirish'}
        </button>
      </form>

      {results && (
        <div className="bg-white rounded-xl shadow-sm border border-line overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-ink-muted">{results.length} ta natija</span>
            {results.length > 0 && (
              <button
                onClick={handleAddAll}
                disabled={addingAll}
                className="bg-white hover:bg-primary-500 text-primary-500 hover:text-white border-2 border-primary-500 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
              >
                {addingAll ? "Qo'shilmoqda..." : "Hammasini qo'shish"}
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12 text-ink-muted text-sm">Hech narsa topilmadi</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1200px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted">Nom</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted">Telefon</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted">Instagram</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted">Telegram</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted">Sayt</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted">Manzil</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted">Ish vaqti</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted"></th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted"></th>
                    <th className="text-left px-4 py-3 font-medium text-ink-muted"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r, i) => {
                    const status = rowStatus[i] ?? 'idle'
                    const eStatus = enrichStatus[i] ?? 'idle'
                    return (
                      <tr key={i}>
                        <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                        <td className="px-4 py-3 text-ink-muted">{r.phone ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-muted">{r.email ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-muted">{r.instagram ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-muted">{r.telegram ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-muted">
                          {r.website ? (
                            <a
                              href={r.website.startsWith('http') ? r.website : `https://${r.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-500 hover:underline"
                            >
                              {r.website}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{r.address ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-muted">{r.opening_hours ?? '—'}</td>
                        <td className="px-4 py-3">
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(`${r.name} ${searchedCity}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-500 hover:underline"
                          >
                            Tekshirish
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => enrichRow(i)}
                            disabled={eStatus === 'loading'}
                            className="bg-white hover:bg-primary-500 text-primary-500 hover:text-white border border-primary-500 px-3 py-1 rounded-lg text-xs font-medium transition disabled:opacity-50"
                            title="Web qidiruv orqali telefon/email/Instagram/Telegram topish"
                          >
                            {eStatus === 'loading' ? '...' : eStatus === 'done' ? "Boyitildi ✓" : 'Boyitish'}
                          </button>
                          {eStatus === 'error' && (
                            <p className="text-xs text-red-600 mt-1 max-w-[160px]">{enrichError[i]}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {status === 'added' || status === 'duplicate' ? (
                            rowLeadId[i] ? (
                              <Link
                                href={`/leads/${rowLeadId[i]}`}
                                className="text-xs text-primary-500 hover:underline"
                              >
                                {status === 'added' ? "Qo'shildi →" : "Qo'shilgan →"}
                              </Link>
                            ) : (
                              <span className="text-xs text-ink-muted">
                                {status === 'added' ? "Qo'shildi" : "Qo'shilgan"}
                              </span>
                            )
                          ) : (
                            <button
                              onClick={() => addLeads([i])}
                              disabled={status === 'adding'}
                              className="bg-white hover:bg-primary-500 text-primary-500 hover:text-white border border-primary-500 px-3 py-1 rounded-lg text-xs font-medium transition disabled:opacity-50"
                            >
                              {status === 'adding' ? '...' : "Bazaga qo'shish"}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
