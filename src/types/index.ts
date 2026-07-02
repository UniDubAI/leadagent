export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'qualified'
  | 'closed_won'
  | 'closed_lost'

export type OutreachChannel = 'email' | 'linkedin'
export type MessageStatus = 'draft' | 'sent'

export interface Lead {
  id: string
  name: string
  company: string | null
  email: string | null
  linkedin_url: string | null
  phone: string | null
  status: LeadStatus
  industry: string | null
  message_language: string | null
  source: string | null
  notes: string | null
  email_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface OutreachMessage {
  id: string
  lead_id: string
  channel: OutreachChannel
  subject: string | null
  body: string
  status: MessageStatus
  sent_at: string | null
  created_at: string
}

export interface LeadWithMessages extends Lead {
  outreach_messages: OutreachMessage[]
}
