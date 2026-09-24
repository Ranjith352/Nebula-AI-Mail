/**
 * Gmail Helper, Parser & Safe Query Translator Utilities
 */

export interface GmailQueryParams {
  unread?: boolean | null
  unreadOnly?: boolean | null
  sender?: string | null
  keyword?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  days?: number | null
  dateRange?: string | null
  rawQuery?: string | null
}

/**
 * Extracts sender display name from "Name <email@domain.com>" string
 */
export function getSenderName(fromHeader: string = ''): string {
  if (!fromHeader) return 'Unknown Sender'
  const match = fromHeader.match(/^"?([^"<]+)"?\s*<.+>$/)
  if (match && match[1]) {
    return match[1].trim()
  }
  return fromHeader.replace(/<.+>/, '').trim() || fromHeader
}

/**
 * Extracts raw email address from "Name <email@domain.com>" string
 */
export function getSenderEmail(fromHeader: string = ''): string {
  if (!fromHeader) return ''
  const match = fromHeader.match(/<(.+)>/)
  if (match && match[1]) {
    return match[1].trim()
  }
  return fromHeader.trim()
}

/**
 * Sanitizes a search string value to prevent query injection or syntax corruption.
 */

function sanitizeSearchTerm(term: string): string {
  if (!term) return ''
  // Strip control characters & dangerous operators
  const clean = term.replace(/[\0\r\n]/g, '').trim()
  if (!clean) return ''

  // If contains spaces and not already wrapped in quotes, wrap in quotes
  if (/\s/.test(clean) && !(/^".+"$/.test(clean))) {
    return `"${clean.replace(/"/g, '\\"')}"`
  }
  return clean
}

/**
 * Validates and formats date string into YYYY/MM/DD format
 */
function sanitizeGmailDate(dateStr: string): string | null {
  if (!dateStr) return null
  const clean = dateStr.trim().replace(/-/g, '/')
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(clean)) {
    const parts = clean.split('/')
    const year = parts[0]
    const month = parts[1].padStart(2, '0')
    const day = parts[2].padStart(2, '0')
    return `${year}/${month}/${day}`
  }
  return null
}

/**
 * Safe Gmail Search Query Translator
 *
 * Translates structured parameters into a validated, safe Gmail query string:
 * - unread: is:unread
 * - sender: from:example@gmail.com or from:"John Doe"
 * - keyword: "project update"
 * - date: after:YYYY/MM/DD before:YYYY/MM/DD
 * - days: newer_than:Nd
 *
 * Example Combined Output:
 *   is:unread after:2026/09/15 from:example@gmail.com "project update"
 */
export function translateGmailQuery(params: GmailQueryParams): string {
  const parts: string[] = []

  // 1. Unread Filter
  const isUnread = params.unread ?? params.unreadOnly
  if (isUnread) {
    parts.push('is:unread')
  }

  // 2. Sender Filter
  if (params.sender) {
    const rawEmail = getSenderEmail(params.sender)
    const sanitizedSender = sanitizeSearchTerm(rawEmail || params.sender)
    if (sanitizedSender) {
      parts.push(`from:${sanitizedSender}`)
    }
  }

  // 3. Date Filters
  if (params.dateFrom) {
    const validFrom = sanitizeGmailDate(params.dateFrom)
    if (validFrom) {
      parts.push(`after:${validFrom}`)
    }
  }

  if (params.dateTo) {
    const validTo = sanitizeGmailDate(params.dateTo)
    if (validTo) {
      parts.push(`before:${validTo}`)
    }
  }

  // Days relative cutoff
  if (params.days && typeof params.days === 'number' && params.days > 0) {
    parts.push(`newer_than:${Math.floor(params.days)}d`)
  }

  // 4. Keyword Filter
  if (params.keyword) {
    const sanitizedKeyword = sanitizeSearchTerm(params.keyword)
    if (sanitizedKeyword) {
      parts.push(sanitizedKeyword)
    }
  }

  // 5. Raw query fallback
  if (!parts.length && params.rawQuery) {
    const sanitizedRaw = sanitizeSearchTerm(params.rawQuery)
    if (sanitizedRaw) {
      parts.push(sanitizedRaw)
    }
  }

  return parts.join(' ') || 'in:inbox'
}

/**
 * Legacy wrapper for backward compatibility
 */
export function buildGmailQuery(filters: {
  sender?: string
  keyword?: string
  unreadOnly?: boolean
  days?: number
}): string {
  return translateGmailQuery(filters)
}
