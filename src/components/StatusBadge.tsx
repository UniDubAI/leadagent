import { LeadStatus } from '@/types'

const config: Record<LeadStatus, { label: string; className: string }> = {
  new:          { label: 'Yangi',        className: 'bg-blue-100 text-blue-700' },
  contacted:    { label: 'Murojaat',     className: 'bg-yellow-100 text-yellow-700' },
  replied:      { label: 'Javob berdi',  className: 'bg-purple-100 text-purple-700' },
  qualified:    { label: 'Qualified',    className: 'bg-orange-100 text-orange-700' },
  closed_won:   { label: 'Yutildi',      className: 'bg-green-100 text-green-700' },
  closed_lost:  { label: 'Yutqazildi',   className: 'bg-red-100 text-red-700' },
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
