/**
 * AI Tool & CopilotKit Action Types
 */

export interface ComposeEmailParams {
  to: string
  subject: string
  body?: string
}

export interface SearchEmailsParams {
  query?: string
  sender?: string
  keyword?: string
  days?: number
  unreadOnly?: boolean
}

export interface ReplyToParams {
  emailId?: string
  body?: string
}

export interface FilterInboxParams {
  unreadOnly?: boolean
  dateRange?: string
  sender?: string
  keyword?: string
}

export interface AIActionResponse {
  success: boolean
  message: string
}
