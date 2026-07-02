import { LeadStatus } from '@/types'

// Pipeline stages read blue -> green as a lead progresses; closed_won gets
// the full brand gradient. closed_lost stays neutral gray on purpose — a
// lost deal shouldn't wear the "success" brand colors.
const config: Record<LeadStatus, { label: string; className: string }> = {
  new:          { label: 'Yangi',        className: 'bg-secondary-50 text-secondary-700' },
  contacted:    { label: 'Murojaat',     className: 'bg-secondary-100 text-secondary-700' },
  replied:      { label: 'Javob berdi',  className: 'bg-primary-50 text-primary-700' },
  qualified:    { label: 'Qualified',    className: 'bg-primary-100 text-primary-700' },
  closed_won:   { label: 'Yutildi',      className: 'bg-brand-gradient text-white' },
  closed_lost:  { label: 'Yutqazildi',   className: 'bg-gray-100 text-gray-500' },
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
