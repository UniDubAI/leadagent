'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { RecommendationItem, RecommendationsRecord } from '@/types'

function normalizeItem(item: string | RecommendationItem): RecommendationItem {
  if (typeof item === 'string') return { text: item, action_type: 'boshqa', lead_id: null, platform: null, context: null }
  return item
}

function actionHref(item: RecommendationItem): string | null {
  if ((item.action_type === 'email_yuborish' || item.action_type === 'followup') && item.lead_id) {
    const params = new URLSearchParams()
    if (item.context) params.set('kontekst', item.context)
    const qs = params.toString()
    return `/leads/${item.lead_id}${qs ? `?${qs}` : ''}`
  }
  if (item.action_type === 'smm_post') {
    const params = new URLSearchParams()
    if (item.platform) params.set('platform', item.platform)
    if (item.context) params.set('kontekst', item.context)
    const qs = params.toString()
    return `/smm${qs ? `?${qs}` : ''}`
  }
  return null
}

export default function TavsiyalarPage() {
  const [record, setRecord] = useState<RecommendationsRecord | null | undefined>(undefined)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/recommendations')
      .then((r) => r.json())
      .then((data) => setRecord(data))
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError('')

    const res = await fetch('/api/recommendations', { method: 'POST' })
    const data = await res.json()

    setRefreshing(false)

    if (!res.ok) {
      setError(data.error ?? 'Tavsiyalarni tayyorlashda xatolik yuz berdi')
      return
    }

    setRecord(data)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Tavsiyalar</h1>
          <p className="text-sm text-ink-muted mt-1">
            Lidlaringiz va SMM faolligingiz asosida AI tayyorlagan amaliy maslahatlar
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 shrink-0"
        >
          {refreshing ? 'Tahlil qilinmoqda...' : 'Tavsiyalarni yangilash'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {record === undefined ? (
        <div className="text-center py-16 text-ink-muted">Yuklanmoqda...</div>
      ) : record === null ? (
        <div className="bg-white rounded-xl shadow-sm border border-line text-center py-16 px-6">
          <p className="text-ink-muted">
            Hali tavsiya yo&apos;q. Yuqoridagi <span className="font-medium text-ink">&quot;Tavsiyalarni yangilash&quot;</span> tugmasini bosing.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-muted mb-3">
            Oxirgi yangilanish: {new Date(record.generated_at).toLocaleString('uz-UZ')}
          </p>
          <div className="bg-white rounded-xl shadow-sm border border-line divide-y divide-gray-100">
            {record.items.map((raw, index) => {
              const item = normalizeItem(raw)
              const href = actionHref(item)
              return (
                <div key={index} className="flex items-center gap-3 px-5 py-4">
                  <span className="text-primary-500 font-bold shrink-0">{index + 1}.</span>
                  <p className="text-sm text-ink flex-1">{item.text}</p>
                  {href && (
                    <Link
                      href={href}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-primary-500 hover:bg-primary-600 text-white transition shrink-0"
                    >
                      Bajarish
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
