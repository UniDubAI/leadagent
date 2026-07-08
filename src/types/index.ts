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
  last_contact_at: string | null
  followup_sent_at: string | null
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

export type SmmIndustry = 'Restoran' | "Go'zallik" | 'Avto' | "Ta'lim" | "Do'kon" | 'Boshqa'
export type SmmPlatform = 'instagram' | 'telegram' | 'both'
export type SmmContentType = 'single' | 'weekly' | 'launch'
export type SmmLanguage = "O'zbek" | 'Rus'

export interface SmmPost {
  label: string
  content: string
  trend_basis?: string
}

export interface BusinessProfile {
  id: string
  business_name: string
  industry: string
  description: string | null
  city: string | null
  created_at: string
  updated_at: string
}

export interface SmmPostRecord {
  id: string
  platform: SmmPlatform
  content_type: SmmContentType
  language: string
  consider_trends: boolean
  posts: SmmPost[]
  created_at: string
}

export type SearchIndustry = 'restoran' | 'gozallik' | 'dokon' | 'fitnes' | 'talim' | 'boshqa'

export interface OsmSearchResult {
  name: string
  address: string | null
  phone: string | null
  website: string | null
  email: string | null
}

export interface BizReview {
  author: string
  text: string
}

export interface BizPage {
  id: string
  slug: string
  business_name: string
  tagline: string | null
  phone: string | null
  address: string | null
  instagram: string | null
  telegram: string | null
  facebook: string | null
  website: string | null
  menu_url: string | null
  working_hours: string | null
  reviews: BizReview[]
  theme: string
  lead_id: string | null
  created_at: string
}

export interface RecommendationsRecord {
  id: string
  items: string[]
  generated_at: string
}
