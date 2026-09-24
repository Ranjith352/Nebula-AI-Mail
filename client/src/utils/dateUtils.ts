/**
 * Date Formatting, Comparison, and Semantic Date Calculation Utilities
 */

export interface DateRangeResult {
  dateFrom: string   // YYYY/MM/DD
  dateTo: string     // YYYY/MM/DD
  queryClause: string // Gmail API query clause (e.g. "after:2026/09/14 before:2026/09/21")
}

/**
 * Format a Date object to YYYY/MM/DD in consistent timezone
 */
export function formatDateToGmailStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

/**
 * Deterministically resolves a semantic date range string into actual dates and Gmail query terms.
 *
 * Supported semantic ranges:
 * - today
 * - yesterday
 * - this_week / this week
 * - last_week / last week
 * - last_7_days / last 7 days / 7days
 * - last_10_days / last 10 days / 10days
 * - this_month / this month
 * - specific date strings (YYYY-MM-DD or YYYY/MM/DD)
 */
export function resolveSemanticDateRange(semanticRange?: string): DateRangeResult {
  const now = new Date()
  const todayStr = formatDateToGmailStr(now)

  if (!semanticRange) {
    return { dateFrom: '', dateTo: '', queryClause: '' }
  }

  const normalized = semanticRange.toLowerCase().trim().replace(/_/g, ' ')

  switch (normalized) {
    case 'today': {
      const fromStr = todayStr
      return {
        dateFrom: fromStr,
        dateTo: fromStr,
        queryClause: `after:${fromStr}`,
      }
    }

    case 'yesterday': {
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      const yestStr = formatDateToGmailStr(yesterday)
      return {
        dateFrom: yestStr,
        dateTo: todayStr,
        queryClause: `after:${yestStr} before:${todayStr}`,
      }
    }

    case 'this week': {
      // Start of current week (Monday)
      const dayOfWeek = now.getDay() // 0 = Sun, 1 = Mon ...
      const diffToMon = (dayOfWeek + 6) % 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - diffToMon)
      const monStr = formatDateToGmailStr(monday)
      return {
        dateFrom: monStr,
        dateTo: todayStr,
        queryClause: `after:${monStr}`,
      }
    }

    case 'last week': {
      // Previous week Monday to Sunday
      const dayOfWeek = now.getDay()
      const diffToMon = (dayOfWeek + 6) % 7
      const lastMon = new Date(now)
      lastMon.setDate(now.getDate() - diffToMon - 7)
      const lastSun = new Date(now)
      lastSun.setDate(now.getDate() - diffToMon)
      const lastMonStr = formatDateToGmailStr(lastMon)
      const lastSunStr = formatDateToGmailStr(lastSun)
      return {
        dateFrom: lastMonStr,
        dateTo: lastSunStr,
        queryClause: `after:${lastMonStr} before:${lastSunStr}`,
      }
    }

    case 'last 7 days':
    case '7days':
    case '7 days': {
      const d7 = new Date(now)
      d7.setDate(now.getDate() - 7)
      const d7Str = formatDateToGmailStr(d7)
      return {
        dateFrom: d7Str,
        dateTo: todayStr,
        queryClause: `newer_than:7d`,
      }
    }

    case 'last 10 days':
    case '10days':
    case '10 days': {
      const d10 = new Date(now)
      d10.setDate(now.getDate() - 10)
      const d10Str = formatDateToGmailStr(d10)
      return {
        dateFrom: d10Str,
        dateTo: todayStr,
        queryClause: `newer_than:10d`,
      }
    }

    case 'this month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const firstStr = formatDateToGmailStr(firstOfMonth)
      return {
        dateFrom: firstStr,
        dateTo: todayStr,
        queryClause: `after:${firstStr}`,
      }
    }

    case 'last month': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      const firstStr = formatDateToGmailStr(firstOfLastMonth)
      const lastStr = formatDateToGmailStr(lastOfLastMonth)
      return {
        dateFrom: firstStr,
        dateTo: lastStr,
        queryClause: `after:${firstStr} before:${lastStr}`,
      }
    }

    case 'last 30 days':
    case '30days':
    case '30 days':
    case 'month': {
      const d30 = new Date(now)
      d30.setDate(now.getDate() - 30)
      const d30Str = formatDateToGmailStr(d30)
      return {
        dateFrom: d30Str,
        dateTo: todayStr,
        queryClause: `newer_than:30d`,
      }
    }

    case 'this year': {
      const firstOfYear = new Date(now.getFullYear(), 0, 1)
      const firstStr = formatDateToGmailStr(firstOfYear)
      return {
        dateFrom: firstStr,
        dateTo: todayStr,
        queryClause: `after:${firstStr}`,
      }
    }

    case 'last year': {
      const firstOfLastYear = new Date(now.getFullYear() - 1, 0, 1)
      const lastOfLastYear = new Date(now.getFullYear() - 1, 11, 31)
      const firstStr = formatDateToGmailStr(firstOfLastYear)
      const lastStr = formatDateToGmailStr(lastOfLastYear)
      return {
        dateFrom: firstStr,
        dateTo: lastStr,
        queryClause: `after:${firstStr} before:${lastStr}`,
      }
    }

    default: {
      // Check if input is a specific date or date range (YYYY-MM-DD or YYYY/MM/DD)
      const dateMatch = normalized.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[1])
        if (!isNaN(parsedDate.getTime())) {
          const parsedStr = formatDateToGmailStr(parsedDate)
          return {
            dateFrom: parsedStr,
            dateTo: parsedStr,
            queryClause: `after:${parsedStr}`,
          }
        }
      }
      return { dateFrom: '', dateTo: '', queryClause: '' }
    }
  }
}

/**
 * Formats an email timestamp relative to current date (e.g., "10:45 AM", "Yesterday", "Sep 18")
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isThisYear = date.getFullYear() === now.getFullYear()
  if (isThisYear) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Checks if a date falls within N days from now
 */
export function isWithinDays(dateInput: string | Date, days: number): boolean {
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return false

  const cutoff = Date.now() - days * 86400000
  return date.getTime() >= cutoff
}
