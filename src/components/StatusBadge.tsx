'use client'

import { useTranslations } from 'next-intl'
import { LeadStatus } from '@/types'

// Every status, including closed_won, shares the same white/brown outline badge.
const className = 'bg-white border-primary-500 text-primary-500'

export function StatusBadge({ status }: { status: LeadStatus }) {
  const t = useTranslations('StatusBadge')
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${className}`}>
      {t(status)}
    </span>
  )
}
