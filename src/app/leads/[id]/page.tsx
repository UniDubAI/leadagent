'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { LeadWithMessages, LeadStatus, OutreachChannel, OutreachMessage } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { localeToBCP47 } from '@/i18n/config'

const STATUSES: LeadStatus[] = ['new', 'contacted', 'replied', 'qualified', 'closed_won', 'closed_lost']
// message_language DB'da erkin matn sifatida saqlanadi va outreach
// generatsiya promptida aynan shu qiymat bilan solishtiriladi — tarjima qilinmaydi.
const LANGUAGE_OPTIONS = ["O'zbek", 'Rus', 'Ingliz']

function daysAgo(dateStr: string, t: ReturnType<typeof useTranslations>) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (days <= 0) return t('today')
  return t('daysAgoN', { days })
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('LeadDetail')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [lead, setLead] = useState<LeadWithMessages | null>(null)
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<OutreachChannel>('email')
  const [context, setContext] = useState('')
  const [messageLanguage, setMessageLanguage] = useState<string>("O'zbek")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sendError, setSendError] = useState('')
  const [activeMessage, setActiveMessage] = useState<OutreachMessage | null>(null)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [channelCopied, setChannelCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState('')
  const [enrichError, setEnrichError] = useState('')

  const fetchLead = () => {
    fetch(`/api/leads/${id}`)
      .then((r) => r.json())
      .then((data: LeadWithMessages) => {
        setLead(data)
        setLoading(false)
        setMessageLanguage(data.message_language || "O'zbek")
        setEditEmail(data.email ?? '')
        setEditPhone(data.phone ?? '')
      })
  }

  useEffect(() => { fetchLead() }, [id])

  useEffect(() => {
    const kontekst = searchParams.get('kontekst')
    if (kontekst) setContext(kontekst)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      body: JSON.stringify({ lead_id: id, channel, context, language: messageLanguage }),
    })
    const data = await res.json()
    setGenerating(false)
    if (data.message) {
      setActiveMessage(data.message)
      setDraftSubject(data.message.subject ?? '')
      setDraftBody(data.message.body ?? '')
      setEmailSent(false)
      setSendError('')
      setChannelCopied(false)
      fetchLead()
    }
  }

  const copyChannelMessage = () => {
    if (!activeMessage) return
    navigator.clipboard.writeText(activeMessage.body)
    setChannelCopied(true)
    setTimeout(() => setChannelCopied(false), 2000)
  }

  const sendEmail = async () => {
    if (!activeMessage || !lead) return
    if (/\[[^[\]\n]{1,50}\]/.test(draftSubject) || /\[[^[\]\n]{1,50}\]/.test(draftBody)) {
      alert(t('placeholderMissing'))
      return
    }
    if (!lead.email) {
      alert(t('emailRequired'))
      setEditing(true)
      return
    }
    if (!confirm(t('confirmSend'))) return

    setSending(true)
    setSendError('')

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: lead.email,
        subject: draftSubject,
        body: draftBody,
        leadId: id,
        messageId: activeMessage.id,
      }),
    })

    setSending(false)

    if (!res.ok) {
      const data = await res.json()
      setSendError(data.error ?? t('sendEmailError'))
      return
    }

    setEmailSent(true)
    fetchLead()
  }

  const saveContact = async () => {
    setSavingContact(true)
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
      }),
    })
    setSavingContact(false)
    setEditing(false)
    fetchLead()
  }

  const enrichLead = async () => {
    setEnriching(true)
    setEnrichResult('')
    setEnrichError('')

    const res = await fetch(`/api/leads/${id}/enrich`, { method: 'POST' })
    const data = await res.json()

    setEnriching(false)

    if (!res.ok) {
      setEnrichError(data.error ?? t('enrichError'))
      return
    }

    const found: string[] = []
    if (data.updated?.email) found.push(`email: ${data.updated.email}`)
    if (data.updated?.phone) found.push(`${t('phone')}: ${data.updated.phone}`)
    if (data.found?.instagram) found.push(`Instagram: ${data.found.instagram}`)
    if (data.found?.telegram) found.push(`Telegram: ${data.found.telegram}`)
    setEnrichResult(found.length > 0 ? t('enrichFound', { list: found.join(', ') }) : t('enrichNothingFound'))
    fetchLead()
  }

  const deleteLead = async () => {
    if (!confirm(t('deleteConfirm', { name: lead?.name ?? '' }))) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    router.push('/leads')
  }

  if (loading) return <div className="text-center py-16 text-ink-muted">{t('loading')}</div>
  if (!lead) return <div className="text-center py-16 text-ink-muted">{t('notFound')}</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/leads" className="text-sm text-ink-muted hover:text-ink">{t('backToList')}</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Lead info */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-line p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-xl font-bold text-ink">{lead.name}</h1>
                {lead.company && <p className="text-ink-muted text-sm">{lead.company}</p>}
              </div>
              <StatusBadge status={lead.status as LeadStatus} />
            </div>

            {editing ? (
              <div className="space-y-2 mb-3">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">{t('email')}</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@misol.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">{t('phone')}</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+998..."
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveContact}
                    disabled={savingContact}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-primary-500 hover:bg-primary-600 text-white transition disabled:opacity-50"
                  >
                    {savingContact ? t('saving') : t('save')}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false)
                      setEditEmail(lead.email ?? '')
                      setEditPhone(lead.phone ?? '')
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-ink-muted hover:text-ink transition"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-ink-muted mb-1">
                  <span className="font-medium">{t('email')}:</span> {lead.email || '—'}
                </p>
                {lead.email_sent_at && (
                  <p className="text-sm text-ink-muted mb-1">
                    <span className="font-medium">{t('lastEmail')}:</span>{' '}
                    {new Date(lead.email_sent_at).toLocaleDateString(localeToBCP47[locale as keyof typeof localeToBCP47])}
                  </p>
                )}
                {lead.last_contact_at && (
                  <p className="text-sm text-ink-muted mb-1">
                    <span className="font-medium">{t('lastContact')}:</span> {daysAgo(lead.last_contact_at, t)}
                  </p>
                )}
                <p className="text-sm text-ink-muted mb-1">
                  <span className="font-medium">{t('phone')}:</span> {lead.phone || '—'}
                </p>
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs text-primary-500 hover:text-primary-600 font-medium"
                  >
                    ✎ {t('editContact')}
                  </button>
                  <button
                    onClick={enrichLead}
                    disabled={enriching}
                    className="text-xs text-primary-500 hover:text-primary-600 font-medium disabled:opacity-50"
                    title={t('enrichTitle')}
                  >
                    {enriching ? t('enriching') : `🔎 ${t('enrich')}`}
                  </button>
                </div>
                {enrichResult && <p className="text-xs text-ink-muted mb-2">{enrichResult}</p>}
                {enrichError && <p className="text-xs text-red-600 mb-2">{enrichError}</p>}
              </>
            )}
            {lead.linkedin_url && (
              <p className="text-sm text-ink-muted mb-1">
                <span className="font-medium">LinkedIn:</span>{' '}
                <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="text-primary-500 hover:text-primary-600 hover:underline">
                  {t('profile')}
                </a>
              </p>
            )}
            {lead.industry && (
              <p className="text-sm text-ink-muted mb-1">
                <span className="font-medium">{t('industry')}:</span> {lead.industry}
              </p>
            )}
            {lead.source && (
              <p className="text-sm text-ink-muted mb-1">
                <span className="font-medium">{t('source')}:</span> {lead.source}
              </p>
            )}
            {lead.message_language && (
              <p className="text-sm text-ink-muted mb-1">
                <span className="font-medium">{t('messageLanguage')}:</span> {lead.message_language}
              </p>
            )}
            {lead.notes && (
              <p className="text-sm text-ink-muted mt-3 border-t pt-3">{lead.notes}</p>
            )}
          </div>

          {/* Status update */}
          <div className="bg-white rounded-xl shadow-sm border border-line p-5">
            <p className="text-sm font-medium text-ink mb-3">{t('changeStatus')}</p>
            <div className="flex flex-col gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    lead.status === s
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-50 text-ink-muted hover:bg-gray-100'
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
            {t('deleteLead')}
          </button>
        </div>

        {/* Right: Outreach panel */}
        <div className="md:col-span-2 space-y-4">
          {/* Generate section */}
          <div className="bg-white rounded-xl shadow-sm border border-line p-5">
            <h2 className="font-semibold text-ink mb-4">{t('outreachTitle')}</h2>

            <div className="flex gap-2 mb-4 flex-wrap">
              {(['email', 'linkedin', 'telegram', 'instagram'] as OutreachChannel[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    channel === ch
                      ? 'bg-primary-500 text-white border-transparent'
                      : 'bg-white text-ink-muted border-gray-300 hover:border-primary-500'
                  }`}
                >
                  {t(`channels.${ch}`)}
                </button>
              ))}

              <select
                value={messageLanguage}
                onChange={(e) => setMessageLanguage(e.target.value)}
                className="ml-auto border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('contextPlaceholder')}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />

            <button
              onClick={generateMessage}
              disabled={generating}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {generating ? t('generating') : t('generateFor', { channel: t(`channelNames.${channel}`) })}
            </button>
          </div>

          {/* Active/latest generated message */}
          {activeMessage && activeMessage.channel === 'email' && (
            <div className="bg-white rounded-xl border border-primary-500 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-primary-500">{t('newDraft')}</p>
                <span className="text-xs text-primary-500 uppercase">{activeMessage.channel}</span>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-ink-muted mb-1">{t('subject')}</label>
                <input
                  type="text"
                  disabled={sending || emailSent}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-ink-muted mb-1">{t('body')}</label>
                <textarea
                  rows={8}
                  disabled={sending || emailSent}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                />
              </div>

              <div>
                <button
                  onClick={sendEmail}
                  disabled={sending || emailSent}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                    emailSent
                      ? 'bg-primary-500 text-white'
                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }`}
                >
                  {sending ? t('sending') : emailSent ? t('sent') : t('sendEmail')}
                </button>
                {!lead.email && (
                  <p className="text-xs text-red-600 mt-2">{t('noEmailWarning')}</p>
                )}
                {sendError && <p className="text-xs text-red-600 mt-2">{sendError}</p>}
              </div>
            </div>
          )}

          {activeMessage && activeMessage.channel === 'linkedin' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-primary-500 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-primary-500">{t('connectionRequest')}</p>
                  <span className="text-xs text-primary-500">{(activeMessage.subject ?? '').length}/300</span>
                </div>
                <pre className="text-sm text-ink whitespace-pre-wrap font-sans mb-3">{activeMessage.subject}</pre>
                <button
                  onClick={() => navigator.clipboard.writeText(activeMessage.subject ?? '')}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium bg-primary-500 hover:bg-primary-600 text-white transition"
                >
                  {t('copy')}
                </button>
              </div>

              <div className="bg-white rounded-xl border border-primary-500 p-5">
                <p className="text-sm font-semibold text-primary-500 mb-2">{t('dmAfterConnection')}</p>
                <pre className="text-sm text-ink whitespace-pre-wrap font-sans mb-3">{activeMessage.body}</pre>
                <button
                  onClick={() => navigator.clipboard.writeText(activeMessage.body)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium bg-primary-500 hover:bg-primary-600 text-white transition"
                >
                  {t('copy')}
                </button>
              </div>

              <p className="text-xs text-ink-muted px-1">{t('linkedinNote')}</p>
            </div>
          )}

          {activeMessage && (activeMessage.channel === 'telegram' || activeMessage.channel === 'instagram') && (
            <div className="bg-white rounded-xl border border-primary-500 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-primary-500">{t('newDraft')}</p>
                <span className="text-xs text-primary-500 uppercase">{activeMessage.channel}</span>
              </div>
              <pre className="text-sm text-ink whitespace-pre-wrap font-sans mb-4">{activeMessage.body}</pre>

              <div>
                <button
                  onClick={copyChannelMessage}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    channelCopied
                      ? 'bg-white border border-primary-500 text-primary-500'
                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }`}
                >
                  {channelCopied ? t('copied') : t('copy')}
                </button>
                <p className="text-xs text-ink-muted mt-2">
                  {activeMessage.channel === 'telegram' ? t('telegramNote') : t('instagramNote')}
                </p>
              </div>
            </div>
          )}

          {/* Message history */}
          {lead.outreach_messages?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-line p-5">
              <h3 className="font-semibold text-ink mb-4">{t('messageHistory')}</h3>
              <div className="space-y-3">
                {[...lead.outreach_messages]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((msg) => (
                    <div key={msg.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium uppercase text-ink-muted">{msg.channel}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${msg.status === 'sent' ? 'bg-white border border-primary-500 text-primary-500' : 'bg-gray-100 text-ink-muted'}`}>
                          {msg.status === 'sent' ? t('statusSent') : t('statusDraft')}
                        </span>
                        <span className="text-xs text-ink-muted ml-auto">
                          {new Date(msg.created_at).toLocaleDateString(localeToBCP47[locale as keyof typeof localeToBCP47])}
                        </span>
                      </div>
                      {msg.subject && (
                        <p className="text-xs font-medium text-ink mb-1">
                          {msg.channel === 'email' ? t('subject') : t('connectionRequest')}: {msg.subject}
                        </p>
                      )}
                      <p className="text-xs text-ink-muted line-clamp-3">{msg.body}</p>
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
