/**
 * Email & Mail State Types
 */

export interface Email {
  id: string
  threadId?: string
  from: string
  to: string
  subject: string
  snippet: string
  date: string | Date
  isRead: boolean
  labels?: string[]
  bodyText?: string
  bodyHtml?: string
}

export interface ComposeData {
  to: string
  subject: string
  body: string
}

export interface FilterState {
  unreadOnly: boolean
  dateRange: 'all' | 'today' | 'week' | '10days' | 'month' | number
  sender: string
  keyword: string
}

export type ViewType = 'inbox' | 'sent' | 'compose' | 'detail' | 'complaints'
