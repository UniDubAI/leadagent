'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LeadWithMessages, LeadStatus, OutreachChannel, OutreachMessage } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'

const STATUSES: LeadStatus[] = ['new', 'contacted', 'replied', 'qualified', 'closed_won', 'closed_lost']

function daysAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'bugun'
  if (days === 1) return '1 kun oldin'
  return `${days} kun oldin`
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [lead, setLead] = useState<LeadWithMessages | null>(null)
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<OutreachChannel>('email')
  const [context, setContext] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sendError, setSendError] = useState('')
  const [activeMessage, setActiveMessage] = useState<OutreachMessage | null>(null)

  const fetchLead = () => {
    fetch(`/api/leads/${id}`)
      .then((r) => r.json())
      .then((data) => { setLead(data); setLoading(false) })
  }

  useEffect(() => { fetchLead() }, [id])

  const updateStatus = async (status: LeadStatus) => {
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchLead()
  }

  const generateMessage = async () => {
    setGenerating(true)
    const res = await fetch('/api/outreach/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: id, channel, context }),
    })
    const data = await res.json()
    setGenerating(false)
    if (data.message) {
      setActiveMessage(data.message)
      setEmailSent(false)
      setSendError('')
      fetchLead()
    }
  }

  const sendEmail = async () => {
    if (!activeMessage || !lead) return
    if (!confirm('Yuborilsinmi?')) return

    setSending(true)
    setSendError('')

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: lead.email,
        subject: activeMessage.subject,
        body: activeMessage.body,
        leadId: id,
      }),
    })

    setSending(false)

    if (!res.ok) {
      const data = await res.json()
      setSendError(data.error ?? 'Email yuborishda xatolik yuz berdi')
      return
    }

    setEmailSent(true)
    fetchLead()
  }

  const deleteLead = async () => {
    if (!confirm(`"${lead?.name}" ni o'chirasizmi?`)) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    router.push('/leads')
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Yuklanmoqda...</div>
  if (!lead) return <div className="text-center py-16 text-gray-400">Lid topilmadi</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/leads" className="text-sm text-gray-500 hover:text-gray-700">← Lidlar ro'yxati</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Lead info */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{lead.name}</h1>
                {lead.company && <p className="text-gray-500 text-sm">{lead.company}</p>}
              </div>
              <StatusBadge status={lead.status as LeadStatus} />
            </div>

            {lead.email && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Email:</span> {lead.email}
              </p>
            )}
            {lead.email_sent_at && (
              <p className="text-sm text-primary-700 mb-1">
                <span className="font-medium">Oxirgi email:</span>{' '}
                {new Date(lead.email_sent_at).toLocaleDateString('uz-UZ')}
              </p>
            )}
            {lead.last_contact_at && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Oxirgi aloqa:</span> {daysAgo(lead.last_contact_at)}
              </p>
            )}
            {lead.phone && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Telefon:</span> {lead.phone}
              </p>
            )}
            {lead.linkedin_url && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">LinkedIn:</span>{' '}
                <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="text-secondary-700 hover:underline">
                  Profil
                </a>
              </p>
            )}
            {lead.industry && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Soha:</span> {lead.industry}
              </p>
            )}
            {lead.source && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Manba:</span> {lead.source}
              </p>
            )}
            {lead.message_language && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Xabar tili:</span> {lead.message_language}
              </p>
            )}
            {lead.notes && (
              <p className="text-sm text-gray-600 mt-3 border-t pt-3">{lead.notes}</p>
            )}
          </div>

          {/* Status update */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">Status o'zgartirish</p>
            <div className="flex flex-col gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    lead.status === s
                      ? 'bg-brand-gradient text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-secondary-50'
                  }`}
                >
                  <StatusBadge status={s} />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={deleteLead}
            className="w-full text-sm text-red-500 hover:text-red-700 py-2"
          >
            Lidni o'chirish
          </button>
        </div>

        {/* Right: Outreach panel */}
        <div className="md:col-span-2 space-y-4">
          {/* Generate section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">AI Outreach Generatsiya</h2>

            <div className="flex gap-2 mb-4">
              {(['email', 'linkedin'] as OutreachChannel[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    channel === ch
                      ? 'bg-brand-gradient text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-secondary-400'
                  }`}
                >
                  {ch === 'email' ? '✉ Email' : '💼 LinkedIn'}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-secondary-500"
              placeholder="Qo'shimcha kontekst (ixtiyoriy): mahsulot, pain point, muloqot sababi..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />

            <button
              onClick={generateMessage}
              disabled={generating}
              className="w-full bg-brand-gradient text-white py-2.5 rounded-lg text-sm font-medium hover:brightness-90 transition disabled:opacity-50"
            >
              {generating ? 'AI yozmoqda...' : `${channel === 'email' ? 'Email' : 'LinkedIn xabar'} generatsiya qilish`}
            </button>
          </div>

          {/* Active/latest generated message */}
          {activeMessage && (
            <div className="bg-secondary-50 rounded-xl border border-secondary-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-secondary-700">Yangi draft</p>
                <span className="text-xs text-secondary-600 uppercase">{activeMessage.channel}</span>
              </div>
              {activeMessage.subject && (
                <p className="text-sm font-medium text-gray-800 mb-2">
                  Mavzu: {activeMessage.subject}
                </p>
              )}
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans mb-4">{activeMessage.body}</pre>

              {activeMessage.channel === 'email' ? (
                <div>
                  <button
                    onClick={sendEmail}
                    disabled={sending || emailSent || !lead.email}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                      emailSent
                        ? 'bg-primary-600 text-white'
                        : 'bg-brand-gradient text-white hover:brightness-90'
                    }`}
                  >
                    {sending ? 'Yuborilmoqda...' : emailSent ? 'Yuborildi ✓' : '✉ Email yuborish'}
                  </button>
                  {!lead.email && (
                    <p className="text-xs text-red-600 mt-2">Lidda email manzil yo&apos;q</p>
                  )}
                  {sendError && <p className="text-xs text-red-600 mt-2">{sendError}</p>}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-yellow-700">LinkedIn xabarni nusxalab, qo'lda yuboring</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(activeMessage.body)}
                    className="text-xs text-secondary-700 hover:underline mt-1"
                  >
                    Nusxalash
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Message history */}
          {lead.outreach_messages?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Xabarlar tarixi</h3>
              <div className="space-y-3">
                {[...lead.outreach_messages]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((msg) => (
                    <div key={msg.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium uppercase text-gray-500">{msg.channel}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${msg.status === 'sent' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                          {msg.status === 'sent' ? 'Yuborildi' : 'Draft'}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(msg.created_at).toLocaleDateString('uz-UZ')}
                        </span>
                      </div>
                      {msg.subject && <p className="text-xs font-medium text-gray-700 mb-1">Mavzu: {msg.subject}</p>}
                      <p className="text-xs text-gray-600 line-clamp-3">{msg.body}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
