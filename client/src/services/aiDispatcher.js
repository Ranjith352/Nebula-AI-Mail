/**
 * AI Action Dispatcher
 *
 * Centralized, validated state dispatcher for AI Tool Calls.
 * Prevents AI tools from directly manipulating components or state ad-hoc.
 *
 * Architecture:
 *   LLM Tool Call
 *       │
 *       ▼
 *   Validation Layer
 *       │
 *       ▼
 *   Action Dispatcher
 *       │
 *       ▼
 *   React State (AppContext)
 *       │
 *       ▼
 *   UI View
 */

import { resolveSemanticDateRange } from '../utils/dateUtils'
import { translateGmailQuery } from '../utils/gmailUtils'

export const AI_ACTIONS = {
  COMPOSE_EMAIL: 'COMPOSE_EMAIL',
  OPEN_EMAIL:    'OPEN_EMAIL',
  FILTER_EMAILS: 'FILTER_EMAILS',
  NAVIGATE:      'NAVIGATE',
  REPLY_TO_EMAIL:'REPLY_TO_EMAIL',
  CONFIRM_SEND:  'CONFIRM_SEND',
  FORWARD_EMAIL: 'FORWARD_EMAIL',
  CLEAR_FILTERS: 'CLEAR_FILTERS',
}

// Maps camelCase, snake_case, and uppercase tool names from LLM to canonical action types
const NORMALIZED_ACTION_MAP = {
  composeEmail:   'COMPOSE_EMAIL',
  compose_email:  'COMPOSE_EMAIL',
  COMPOSE_EMAIL:  'COMPOSE_EMAIL',

  searchEmails:   'FILTER_EMAILS',
  search_emails:  'FILTER_EMAILS',
  filterInbox:    'FILTER_EMAILS',
  filter_inbox:   'FILTER_EMAILS',
  FILTER_EMAILS:  'FILTER_EMAILS',

  openEmail:      'OPEN_EMAIL',
  open_email:     'OPEN_EMAIL',
  OPEN_EMAIL:     'OPEN_EMAIL',

  navigateTo:     'NAVIGATE',
  navigate_to:    'NAVIGATE',
  NAVIGATE:       'NAVIGATE',

  replyToEmail:   'REPLY_TO_EMAIL',
  reply_to_email: 'REPLY_TO_EMAIL',
  REPLY_TO_EMAIL: 'REPLY_TO_EMAIL',

  confirmSend:    'CONFIRM_SEND',
  confirm_send:   'CONFIRM_SEND',
  CONFIRM_SEND:   'CONFIRM_SEND',

  forwardEmail:   'FORWARD_EMAIL',
  forward_email:  'FORWARD_EMAIL',
  FORWARD_EMAIL:  'FORWARD_EMAIL',

  clearFilters:   'CLEAR_FILTERS',
  clear_filters:  'CLEAR_FILTERS',
  CLEAR_FILTERS:  'CLEAR_FILTERS',
}

const ALLOWED_VIEWS = [
  'inbox', 'sent', 'compose', 'email', 'detail',
  'starred', 'important', 'spam', 'trash', 'drafts', 'draft', 'snoozed', 'ai', 'complaints'
]

/**
 * Validates payload and dispatches action to AppContext
 */
export async function dispatchAIAction(rawActionType, payload, context) {
  const {
    setCurrentView,
    setComposeData,
    setFilters,
    openEmail,
    searchEmails,
    sendEmail,
    fetchMailbox,
    openedEmail,
    inboxEmails,
    composeData,
  } = context

  const actionType = NORMALIZED_ACTION_MAP[rawActionType] || rawActionType

  switch (actionType) {
    case AI_ACTIONS.COMPOSE_EMAIL: {
      const { to = '', subject = '', body = '' } = payload || {}

      const cleanTo = (to || '').trim()
      const cleanSubject = (subject || '').trim()
      const cleanBody = (body || '').trim()

      // Visibly open compose view & populate form fields in UI
      setCurrentView('compose')
      setComposeData({ to: cleanTo, subject: cleanSubject, body: cleanBody })

      return {
        success: true,
        action: AI_ACTIONS.COMPOSE_EMAIL,
        message: cleanTo
          ? `I've prepared the email to ${cleanTo}. Would you like me to send it?`
          : `Opened Compose view. Please enter recipient, subject, and message.`,
      }
    }

    case AI_ACTIONS.OPEN_EMAIL: {
      const { emailId, searchHint, sender, person } = payload || {}
      let targetId = emailId
      const queryHint = searchHint || sender || person

      if (!targetId && queryHint) {
        const hint = queryHint.toLowerCase().trim()
        let pool = [...(displayedEmails || []), ...(inboxEmails || [])]

        // If local pool is empty or doesn't match hint, query server search
        if (!pool.some(e => e.from?.toLowerCase().includes(hint) || e.sender?.toLowerCase().includes(hint) || e.subject?.toLowerCase().includes(hint))) {
          try {
            const searchRes = await searchEmails(queryHint)
            const searched = Array.isArray(searchRes) ? searchRes : (searchRes?.emails || [])
            if (searched.length > 0) pool = searched
          } catch (_) {}
        }

        // Sort newest first by internalDate / receivedAt / date
        const sorted = pool.sort((a, b) => {
          const timeA = Number(a.internalDate) || (a.receivedAt ? new Date(a.receivedAt).getTime() : 0)
          const timeB = Number(b.internalDate) || (b.receivedAt ? new Date(b.receivedAt).getTime() : 0)
          return timeB - timeA
        })

        const found = sorted.find(e =>
          e.from?.toLowerCase().includes(hint) ||
          e.sender?.toLowerCase().includes(hint) ||
          e.senderEmail?.toLowerCase().includes(hint) ||
          e.subject?.toLowerCase().includes(hint) ||
          e.snippet?.toLowerCase().includes(hint)
        )
        if (found) targetId = found.id || found.gmailMessageId
      }

      if (!targetId) {
        return {
          success: false,
          action: AI_ACTIONS.OPEN_EMAIL,
          error: `Could not find an email matching "${queryHint || 'search'}".`,
          message: `I couldn't find any emails from "${queryHint || 'search'}".`,
        }
      }

      const opened = await openEmail(targetId)
      setCurrentView('detail')

      const senderDisplay = opened?.sender || opened?.from || queryHint || 'sender'
      return {
        success: true,
        action: AI_ACTIONS.OPEN_EMAIL,
        message: `Opened the latest email from ${senderDisplay}.`,
      }
    }

    case AI_ACTIONS.FILTER_EMAILS: {
      const { sender, keyword, unread, dateFrom, dateTo, dateRange, query, days } = payload || {}

      // Application code deterministically calculates actual dates from semantic range
      const semanticInput = dateRange || (days ? `last ${days} days` : query)
      const resolved = resolveSemanticDateRange(semanticInput)

      const effectiveDateFrom = dateFrom || resolved.dateFrom
      const effectiveDateTo   = dateTo   || resolved.dateTo

      // Safe Gmail Query Translator (validates, sanitizes, and escapes parameters)
      const finalQuery = resolved.queryClause
        ? translateGmailQuery({ unread, sender, keyword }) + ` ${resolved.queryClause}`
        : translateGmailQuery({
            unread,
            sender,
            keyword,
            dateFrom: effectiveDateFrom,
            dateTo: effectiveDateTo,
            days: days ? Number(days) : undefined,
            rawQuery: query,
          })

      // Dispatch to React State
      setFilters(prev => ({
        unreadOnly: unread !== undefined ? Boolean(unread) : prev?.unreadOnly,
        dateRange:  semanticInput || (effectiveDateFrom ? 'custom' : (prev?.dateRange || 'all')),
        sender:     sender !== undefined ? sender : (prev?.sender || ''),
        keyword:    keyword !== undefined ? keyword : (prev?.keyword || ''),
      }))

      const searchResult = await searchEmails(finalQuery)
      const matchingEmails = Array.isArray(searchResult) ? searchResult : (searchResult?.emails || [])

      setCurrentView('inbox')

      const count = matchingEmails.length
      let targetLabel = ''
      if (sender) {
        const cleanSender = sender.trim()
        targetLabel = cleanSender.charAt(0).toUpperCase() + cleanSender.slice(1)
      } else if (keyword) {
        targetLabel = `matching "${keyword}"`
      } else if (query) {
        targetLabel = `matching "${query}"`
      }

      let message = ''
      if (count === 0) {
        message = `I couldn't find any emails ${sender ? `from ${targetLabel}` : targetLabel || 'matching that search'}.`
      } else if (count === 1) {
        message = `I found 1 email ${sender ? `from ${targetLabel}` : targetLabel || 'matching your request'}.`
      } else {
        message = `I found ${count} emails ${sender ? `from ${targetLabel}` : targetLabel || 'matching your request'}.`
      }

      if (semanticInput && !sender && !keyword) {
        message = `Showing emails from ${semanticInput}.`
      }

      return {
        success: true,
        action: AI_ACTIONS.FILTER_EMAILS,
        emails: matchingEmails,
        count,
        message,
      }
    }

    case AI_ACTIONS.NAVIGATE: {
      const { view, destination } = payload || {}
      let target = (view || destination || '').toLowerCase().trim()

      if (target === 'sent folder' || target === 'sent items' || target === 'sent mail') target = 'sent'
      if (target === 'inbox folder' || target === 'primary') target = 'inbox'
      if (target === 'draft folder' || target === 'draft') target = 'drafts'
      if (target === 'trash folder' || target === 'bin' || target === 'trash can') target = 'trash'
      if (target === 'spam folder' || target === 'junk') target = 'spam'
      if (target === 'important folder' || target === 'important emails') target = 'important'
      if (target === 'starred folder' || target === 'starred emails') target = 'starred'

      // Validation
      if (!ALLOWED_VIEWS.includes(target)) {
        throw new Error(`NAVIGATE validation failed: "${target}" is not an allowed view (${ALLOWED_VIEWS.join(', ')}).`)
      }

      // Dispatch to React State & Fetch Mailbox Data
      const nextView = target === 'detail' ? 'email' : target
      setCurrentView(nextView)
      if (fetchMailbox && nextView !== 'compose' && nextView !== 'email' && nextView !== 'detail') {
        fetchMailbox(nextView).catch(() => {})
      }

      const name = target.charAt(0).toUpperCase() + target.slice(1)
      return {
        success: true,
        action: AI_ACTIONS.NAVIGATE,
        message: `Opened ${name}.`,
      }
    }

    case AI_ACTIONS.REPLY_TO_EMAIL: {
      const { emailId, body = '' } = payload || {}

      let target = openedEmail
      const targetId = emailId || openedEmail?.id

      if (targetId) {
        const allEmails = [...(inboxEmails || []), ...(sentEmails || []), ...(displayedEmails || [])]
        const found = allEmails.find(e => e.id === targetId)
        if (found) target = found
      }

      if (!target) {
        return {
          success: false,
          action: AI_ACTIONS.REPLY_TO_EMAIL,
          error: 'No active email is currently open to reply to.',
          message: 'No email is currently open. Please open an email first.'
        }
      }

      const rawFrom = target.senderEmail || target.sender || target.from || ''
      const match = rawFrom.match(/<(.+?)>/)
      const senderEmail = match ? match[1].trim() : (rawFrom || '').trim()

      const origSubject = target.subject || 'Message'
      const subject = origSubject.toLowerCase().startsWith('re:') ? origSubject : `Re: ${origSubject}`
      const responseBody = (body || "I'll review it tomorrow.").trim()

      // Visibly open compose view with prefilled reply fields
      setCurrentView('compose')
      setComposeData({
        to: senderEmail,
        subject,
        body: responseBody,
      })

      return {
        success: true,
        action: AI_ACTIONS.REPLY_TO_EMAIL,
        message: `I've prepared a reply to ${senderEmail}. Would you like me to send it?`,
      }
    }



    case AI_ACTIONS.CONFIRM_SEND: {
      const { confirmed, draft, to, subject, body } = payload || {}

      if (!confirmed) {
        return {
          success: false,
          action: AI_ACTIONS.CONFIRM_SEND,
          message: 'Email send canceled by user. Form preserved.',
        }
      }

      const emailTo = (to || draft?.to || composeData?.to || '').trim()
      const emailSubject = (subject || draft?.subject || composeData?.subject || '').trim()
      const emailBody = (body || draft?.body || composeData?.body || '').trim()

      if (!emailTo || !emailSubject) {
        throw new Error('CONFIRM_SEND validation failed: Compose draft requires both "to" and "subject".')
      }

      const sendResult = await sendEmail({ to: emailTo, subject: emailSubject, body: emailBody })
      if (sendResult?.success) {
        setCurrentView('sent')
        if (fetchMailbox) fetchMailbox('sent').catch(() => {})
        return {
          success: true,
          action: AI_ACTIONS.CONFIRM_SEND,
          message: `Email sent successfully to ${emailTo}.\nSubject: ${emailSubject}`,
        }
      } else {
        return {
          success: false,
          action: AI_ACTIONS.CONFIRM_SEND,
          error: sendResult?.error || 'Gmail API returned an error.',
          message: `I couldn't send the email to ${emailTo}.\nGmail returned an error: ${sendResult?.error || 'Unknown error'}`,
        }
      }
    }

    case AI_ACTIONS.FORWARD_EMAIL: {
      const { to = '', recipient = '', emailId } = payload || {}

      const cleanTo = (to || recipient || '').trim()

      let target = openedEmail
      const targetId = emailId || openedEmail?.id

      if (targetId) {
        const allEmails = [...(inboxEmails || []), ...(sentEmails || []), ...(displayedEmails || [])]
        const found = allEmails.find(e => e.id === targetId)
        if (found) target = found
      }

      if (!target) {
        return {
          success: false,
          action: AI_ACTIONS.FORWARD_EMAIL,
          error: 'No active email is currently open to forward.',
          message: 'No email is currently open. Please open an email first.'
        }
      }

      const origSubject = target.subject || 'Email'
      const subject = origSubject.toLowerCase().startsWith('fwd:') ? origSubject : `Fwd: ${origSubject}`
      const senderStr = target.sender || target.from || target.senderEmail || 'Sender'
      const dateStr = target.receivedAt || target.date ? new Date(target.receivedAt || target.date).toLocaleString() : ''
      const forwardedBody = `---------- Forwarded message ---------\nFrom: ${senderStr}\nDate: ${dateStr}\nSubject: ${origSubject}\nTo: ${target.recipients?.join(', ') || target.to || 'me'}\n\n${target.body || target.snippet || target.bodyText || ''}`

      setCurrentView('compose')
      setComposeData({ to: cleanTo, subject, body: forwardedBody })

      return {
        success: true,
        action: AI_ACTIONS.FORWARD_EMAIL,
        message: cleanTo
          ? `I've prepared the forwarded email to ${cleanTo}. Would you like me to send it?`
          : `Forward UI opened. Please specify a recipient email address.`,
      }
    }



    case AI_ACTIONS.CLEAR_FILTERS: {
      if (context.clearSearch) {
        context.clearSearch()
      } else {
        setFilters({ unreadOnly: false, dateRange: 'all', sender: '', keyword: '' })
        setCurrentView('inbox')
        if (fetchMailbox) fetchMailbox('inbox')
      }
      return {
        success: true,
        action: AI_ACTIONS.CLEAR_FILTERS,
        message: 'All inbox filters cleared. Main Inbox restored.',
      }
    }

    default:
      throw new Error(`AI Action Dispatcher error: Unknown action type "${actionType}".`)
  }
}
