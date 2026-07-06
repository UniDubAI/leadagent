import { LeadStatus } from '@/types'

// Every status, including closed_won, shares the same white/brown outline badge.
const config: Record<LeadStatus, { label: string; className: string }> = {
  new:          { label: 'Yangi',        className: 'bg-white border-primary-500 text-primary-500' },
  contacted:    { label: 'Murojaat',     className: 'bg-white border-primary-500 text-primary-500' },
  replied:      { label: 'Javob berdi',  className: 'bg-white border-primary-500 text-primary-500' },
  qualified:    { label: 'Qualified',    className: 'bg-white border-primary-500 text-primary-500' },
  closed_won:   { label: 'Yutildi',      className: 'bg-white border-primary-500 text-primary-500' },
  closed_lost:  { label: 'Yutqazildi',   className: 'bg-white border-primary-500 text-primary-500' },
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
