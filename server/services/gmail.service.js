'use strict'

/**
 * GmailService
 *
 * The ONLY place in the application that imports or calls the Gmail API.
 * Controllers and routes MUST NOT import googleapis directly — they call
 * methods on this service and receive normalized ApplicationEmail objects.
 *
 * Normalized shape (ApplicationEmail):
 * {
 *   id,           – Gmail message ID
 *   threadId,
 *   sender,       – display name + address  e.g. "Alice <alice@example.com>"
 *   senderEmail,  – bare address            e.g. "alice@example.com"
 *   recipients,   – array of bare addresses
 *   subject,
 *   snippet,
 *   body,         – plain-text body (primary)
 *   bodyHtml,     – HTML body (secondary)
 *   receivedAt,   – JS Date
 *   labels,       – array of Gmail label IDs
 *   isRead,
 * }
 */

const { google } = require('googleapis')

/* ─────────────────────────────────────────────────────────────── */
/* Optional MongoDB models (non-fatal if unavailable)               */
/* ─────────────────────────────────────────────────────────────── */
let EmailCache  = null
let OAuthToken  = null
let Label      = null
try { EmailCache = require('../models/EmailCache')  } catch (_) {}
try { OAuthToken = require('../models/OAuthToken')  } catch (_) {}
try { Label      = require('../models/Label')      } catch (_) {}

const activeSyncLocks = new Map()

async function dbOp(fn) {
  if (!EmailCache) return null
  try   { return await fn() }
  catch (e) {
    if (
      e.name === 'MongoNotConnectedError' ||
      e.name === 'MongoServerSelectionError'
    ) return null
    throw e
  }
}

/* ─────────────────────────────────────────────────────────────── */
/* Internal parser helpers                                          */
/* ─────────────────────────────────────────────────────────────── */

/**
 * Helper to parse, extract, and validate single or multiple recipient email addresses.
 * Supports:
 * - Single email: "user@example.com"
 * - Multiple comma-separated emails: "user1@example.com, user2@domain.com"
 * - Semicolon-separated emails: "user1@example.com; user2@domain.com"
 * - Formatted email addresses with display names: "Alice <alice@example.com>, Bob <bob@domain.com>"
 */
function parseAndValidateRecipients(rawTo) {
  if (!rawTo || typeof rawTo !== 'string') {
    throw new Error('Recipient ("to") email address is required.')
  }

  const trimmedTo = rawTo.trim()
  if (!trimmedTo) {
    throw new Error('Recipient ("to") email address is required.')
  }

  const rawParts = trimmedTo.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
  if (rawParts.length === 0) {
    throw new Error('Recipient ("to") email address is required.')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const validRecipients = []
  const invalidRecipients = []

  for (const part of rawParts) {
    const match = part.match(/<(.+?)>/)
    const emailCandidate = (match ? match[1] : part).trim()

    if (emailRegex.test(emailCandidate)) {
      validRecipients.push(part)
    } else {
      invalidRecipients.push(part)
    }
  }

  if (invalidRecipients.length > 0) {
    throw new Error(
      `Invalid recipient email address format: ${invalidRecipients.map(e => `"${e}"`).join(', ')}. Please check all email IDs.`
    )
  }

  return validRecipients.join(', ')
}

/** Decode Gmail base64url-encoded data */
function _decodeBase64Url(encoded) {
  try {
    return Buffer.from(
      encoded.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf-8')
  } catch { return '' }
}

/** Recursively extract text/plain and text/html bodies from a Gmail payload */
function _extractBody(payload) {
  let bodyText = ''
  let bodyHtml = ''

  function walk(part) {
    if (!part) return
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText += _decodeBase64Url(part.body.data)
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml += _decodeBase64Url(part.body.data)
    }
    if (part.parts?.length) part.parts.forEach(walk)
  }
  walk(payload)

  // Fallback: single-part top-level body
  if (!bodyText && !bodyHtml && payload?.body?.data) {
    const text = _decodeBase64Url(payload.body.data)
    if (payload.mimeType === 'text/html') bodyHtml = text
    else bodyText = text
  }

  return { bodyText, bodyHtml }
}

/** Get a specific header value from a Gmail message headers array */
function _getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

/** Extract bare email address from a "Name <email>" string */
function _parseBareEmail(raw) {
  const match = raw?.match(/<(.+?)>/)
  return match ? match[1].trim() : (raw || '').trim()
}

/** Build RFC 2822/5322 raw email encoded as base64url for the Gmail API */
function _buildRawEmail({ from, to, subject, body, html, replyToMessageId, user }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  
  // Parse display name and bare email address
  let fromEmail = from || ''
  let fromName = user?.name || ''
  const matchFrom = from ? from.match(/^"?([^"<]+)"?\s*<(.+?)>$/) : null
  if (matchFrom) {
    fromName = fromName || matchFrom[1].trim()
    fromEmail = matchFrom[2].trim()
  } else {
    fromEmail = fromEmail.trim()
  }

  const cleanName = fromName ? fromName.replace(/["\r\n]/g, '').trim() : ''
  const formattedFrom = cleanName ? `"${cleanName}" <${fromEmail}>` : `<${fromEmail}>`
  
  // UTF-8 Subject Base64 Encoding per RFC 2047
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject || '(no subject)', 'utf-8').toString('base64')}?=`

  const domain = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'gmail.com'
  const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 10)}@${domain}>`

  const plainText = body || ''
  const htmlContent = html || `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111827; background-color: #ffffff; margin: 0; padding: 12px;">
  ${plainText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>')}
</body>
</html>`

  const headers = [
    `From: ${formattedFrom}`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]

  if (replyToMessageId) {
    const cleanReplyId = replyToMessageId.replace(/[<>]/g, '')
    headers.push(`In-Reply-To: <${cleanReplyId}>`)
    headers.push(`References: <${cleanReplyId}>`)
  }

  const textPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(plainText, 'utf-8').toString('base64'),
  ].join('\r\n')

  const htmlPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlContent, 'utf-8').toString('base64'),
  ].join('\r\n')

  const closingBoundary = `--${boundary}--`

  const fullMime = [
    headers.join('\r\n'),
    '',
    textPart,
    htmlPart,
    closingBoundary,
  ].join('\r\n')

  return Buffer.from(fullMime, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/* ─────────────────────────────────────────────────────────────── */
/* Normalize a raw Gmail message resource → ApplicationEmail       */
/* This is the single source-of-truth normalizer for the whole app */
/* ─────────────────────────────────────────────────────────────── */
function normalizeMessage(msg) {
  if (!msg) return null

  // Support both raw Gmail API responses and cached Mongoose docs
  const raw = msg.toObject ? msg.toObject() : msg
  const headers = raw.payload?.headers || []
  const { bodyText, bodyHtml } = raw.payload
    ? _extractBody(raw.payload)
    : { bodyText: raw.bodyText || '', bodyHtml: raw.bodyHtml || '' }

  const senderRaw   = _getHeader(headers, 'from') || raw.from || raw.sender || raw.senderEmail || ''
  const toRaw       = _getHeader(headers, 'to')   || raw.to   || (Array.isArray(raw.recipients) ? raw.recipients.join(', ') : raw.recipients) || ''
  const toAddresses = toRaw.split(',').map(s => _parseBareEmail(s.trim())).filter(Boolean)

  const dateHeader = _getHeader(headers, 'date')
  let internalDateNum = 0
  if (raw.internalDate && !isNaN(Number(raw.internalDate)) && Number(raw.internalDate) > 0) {
    internalDateNum = Number(raw.internalDate)
  } else if (dateHeader && !isNaN(new Date(dateHeader).getTime())) {
    internalDateNum = new Date(dateHeader).getTime()
  } else if (raw.receivedAt && !isNaN(new Date(raw.receivedAt).getTime())) {
    internalDateNum = new Date(raw.receivedAt).getTime()
  } else if (raw.sentAt && !isNaN(new Date(raw.sentAt).getTime())) {
    internalDateNum = new Date(raw.sentAt).getTime()
  } else if (raw.date && !isNaN(new Date(raw.date).getTime())) {
    internalDateNum = new Date(raw.date).getTime()
  } else if (raw.createdAt && !isNaN(new Date(raw.createdAt).getTime())) {
    internalDateNum = new Date(raw.createdAt).getTime()
  }

  const finalInternalDate = internalDateNum > 0 ? internalDateNum : 0
  const dateObj = new Date(finalInternalDate)

  const msgId = raw.id || raw.gmailId || ''

  return {
    id:             msgId,
    gmailMessageId: msgId,
    threadId:       raw.threadId || '',
    sender:         senderRaw,
    senderEmail:    _parseBareEmail(senderRaw),
    recipients:     toAddresses,
    subject:        _getHeader(headers, 'subject') || raw.subject || '(no subject)',
    snippet:        raw.snippet || '',
    body:           bodyText,
    bodyHtml:       bodyHtml,
    internalDate:   finalInternalDate,
    receivedAt:     dateObj,
    sentAt:         dateObj,
    labels:         raw.labelIds || raw.labels || [],
    isRead:         Array.isArray(raw.labelIds)
      ? !raw.labelIds.includes('UNREAD')
      : (raw.isRead ?? true),
  }
}

/* ─────────────────────────────────────────────────────────────── */
/* GmailService Class                                               */
/* ─────────────────────────────────────────────────────────────── */
class GmailService {
  /**
   * @param {object} user – Mongoose User document (profile only, NO tokens)
   * Tokens are loaded from the OAuthToken collection in _getClient().
   */
  constructor(user) {
    this._user      = user
    this._gmail     = null   // lazy-initialized via _getClient()
    this._tokenDoc  = null   // cached OAuthToken document
  }

  /* ── OAuth2 client (lazy, loads tokens from OAuthToken) ───────── */
  async _getClient() {
    if (this._gmail) return this._gmail

    /* Load tokens from secure OAuthToken collection.                 */
    /* Tokens are NEVER stored on the User document.                  */
    if (!OAuthToken) {
      throw new Error('[GmailService] OAuthToken model unavailable — MongoDB required.')
    }

    this._tokenDoc = await OAuthToken.findOne({ userId: this._user._id })
    if (!this._tokenDoc) {
      throw new Error(`[GmailService] No OAuth token found for user ${this._user.email}. Please re-authenticate.`)
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL,
    )

    oauth2.setCredentials({
      access_token:  this._tokenDoc.accessToken,
      refresh_token: this._tokenDoc.refreshToken,
      expiry_date:   this._tokenDoc.expiryDate,
    })

    // When googleapis auto-refreshes the access token, persist the new one
    oauth2.on('tokens', async (tokens) => {
      try {
        const update = { accessToken: tokens.access_token }
        if (tokens.expiry_date)  update.expiryDate   = tokens.expiry_date
        if (tokens.refresh_token) update.refreshToken = tokens.refresh_token
        await OAuthToken.findOneAndUpdate(
          { userId: this._user._id },
          { $set: update }
        )
        console.log(`[GMAIL SYNC] Token auto-refreshed for ${this._user.email}`)
      } catch (err) {
        console.warn('[GMAIL SYNC] Failed to persist refreshed token:', err.message)
      }
    })

    this._gmail = google.gmail({ version: 'v1', auth: oauth2 })
    return this._gmail
  }

  /**
   * syncLabels() → Synchronizes Gmail labels (system + custom) into MongoDB
   */
  async syncLabels() {
    console.log(`[GMAIL SYNC] Synchronizing labels for user ${this._user.email}...`)
    try {
      const gmail = await this._getClient()
      const listRes = await gmail.users.labels.list({ userId: 'me' })
      const rawLabels = listRes.data.labels || []

      const syncedLabels = []
      for (const lbl of rawLabels) {
        let detail = lbl
        try {
          const detailRes = await gmail.users.labels.get({ userId: 'me', id: lbl.id })
          detail = detailRes.data
        } catch (_) {}

        const labelObj = {
          userId:          this._user._id,
          id:              detail.id,
          name:            detail.name,
          type:            detail.type === 'system' ? 'system' : 'user',
          messagesTotal:   detail.messagesTotal || 0,
          messagesUnread:  detail.messagesUnread || 0,
          threadsTotal:    detail.threadsTotal || 0,
          threadsUnread:   detail.threadsUnread || 0,
          color: {
            textColor:       detail.color?.textColor || '#ffffff',
            backgroundColor: detail.color?.backgroundColor || '#4285f4',
          },
        }

        if (Label) {
          await Label.findOneAndUpdate(
            { userId: this._user._id, id: detail.id },
            { $set: labelObj },
            { upsert: true, new: true }
          ).catch(() => {})
        }
        syncedLabels.push(labelObj)
      }

      console.log(`[GMAIL SYNC] Labels synchronized for ${this._user.email}: ${syncedLabels.length} labels updated.`)
      return syncedLabels
    } catch (err) {
      console.error(`[GMAIL SYNC] Label sync failed for ${this._user.email}:`, err.message)
      return []
    }
  }

  /* ── Internal: fetch full message + cache ─────────────────────── */
  async _fetchFullMessage(id) {
    const gmail = await this._getClient()

    const msgRes = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    })

    const normalized = normalizeMessage(msgRes.data)

    // Write-through cache
    await dbOp(() => EmailCache.findOneAndUpdate(
      { userId: this._user._id, gmailId: id },
      {
        userId:         this._user._id,
        gmailId:        normalized.id,
        gmailMessageId: normalized.id,
        threadId:       normalized.threadId,
        from:        normalized.sender,
        sender:      normalized.sender,
        senderEmail: normalized.senderEmail,
        to:          (normalized.recipients || []).join(', '),
        recipients:  normalized.recipients,
        subject:     normalized.subject,
        snippet:     normalized.snippet,
        bodyText:    normalized.body,
        bodyHtml:    normalized.bodyHtml,
        internalDate: normalized.internalDate,
        date:        normalized.receivedAt,
        receivedAt:  normalized.receivedAt,
        labels:      normalized.labels,
        isRead:      normalized.isRead,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ))

    return normalized
  }

  /* ── Internal: listAllMessages (Follows nextPageToken to completion) ── */
  async listAllMessages({ labelIds = null, q = null, includeSpamTrash = false, maxPages = Infinity } = {}) {
    const gmail = await this._getClient()
    let pageToken = null
    let pageCount = 0
    const discoveredIds = new Set()

    console.log(`[GMAIL SYNC] FULL SYNC START`)
    console.log(`[GMAIL SYNC] Account: ${this._user.email}`)
    if (labelIds && labelIds.length) console.log(`[GMAIL SYNC] Label: ${labelIds.join(', ')}`)

    let socketEmitProgress = null
    try {
      const socketModule = require('../socket/socket')
      socketEmitProgress = socketModule.emitSyncProgress
    } catch (_) {}

    do {
      pageCount++
      const listParams = {
        userId: 'me',
        maxResults: 500,
        includeSpamTrash,
      }
      if (pageToken) listParams.pageToken = pageToken
      if (labelIds && labelIds.length) listParams.labelIds = labelIds
      if (q) listParams.q = q

      const res = await gmail.users.messages.list(listParams)
      const msgs = res.data.messages || []
      msgs.forEach(m => discoveredIds.add(m.id))

      pageToken = res.data.nextPageToken || null

      console.log(`[GMAIL SYNC] Page ${pageCount}`)
      console.log(`[GMAIL SYNC] maxResults: 500`)
      console.log(`[GMAIL SYNC] messages: ${msgs.length}`)
      console.log(`[GMAIL SYNC] nextPageToken: ${Boolean(pageToken)}`)
      console.log(`[GMAIL SYNC] totalFetched: ${discoveredIds.size}`)

      if (socketEmitProgress) {
        const stats = { page: pageCount, fetched: discoveredIds.size, estimate: res.data.resultSizeEstimate || 0, hasMore: Boolean(pageToken) }
        if (this._user.email) socketEmitProgress(this._user.email, stats)
        if (this._user._id)   socketEmitProgress(this._user._id.toString(), stats)
      }
    } while (pageToken && pageCount < maxPages)

    console.log(`[GMAIL SYNC] FINAL PAGE`)
    console.log(`[GMAIL SYNC] messages: ${discoveredIds.size}`)
    console.log(`[GMAIL SYNC] nextPageToken: false`)

    return Array.from(discoveredIds)
  }

  /* ── Internal: list + hydrate with nextPageToken pagination ──────── */
  async _listAndHydrate(query, { maxResults = 50, pageToken = null, labelIds = null, q = null, includeSpamTrash = false } = {}) {
    const gmail = await this._getClient()

    console.log(`[GMAIL SYNC] Fetching page for user ${this._user.email} (token: ${pageToken || 'initial'}, labels: ${labelIds ? labelIds.join(',') : 'none'}, q: ${q || query || 'none'}, limit: ${maxResults})`)

    const listParams = {
      userId: 'me',
      maxResults: Math.min(maxResults, 500),
      includeSpamTrash,
    }
    if (pageToken) listParams.pageToken = pageToken
    if (labelIds && labelIds.length) listParams.labelIds = labelIds
    if (q || query) listParams.q = q || query

    const listRes = await gmail.users.messages.list(listParams)
    const messages = listRes.data.messages || []
    const nextPageToken = listRes.data.nextPageToken || null
    const resultSizeEstimate = listRes.data.resultSizeEstimate || messages.length

    console.log(`[GMAIL SYNC] Messages listed: ${messages.length}, nextPageToken: ${nextPageToken ? 'present' : 'none'}, estimate: ${resultSizeEstimate}`)

    if (!messages.length) {
      return {
        emails: [],
        nextPageToken: null,
        resultSizeEstimate: 0,
        hasMore: false,
      }
    }

    const BATCH = 25
    const results = []

    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH)
      const settled = await Promise.allSettled(
        batch.map(async ({ id }) => {
          // Check MongoDB cache first for metadata/snippets
          const cached = await dbOp(() =>
            EmailCache.findOne({ userId: this._user._id, gmailId: id })
          )
          if (cached && (cached.bodyText !== undefined || cached.snippet !== undefined)) {
            return normalizeMessage({
              id:          cached.gmailId,
              gmailId:     cached.gmailId,
              threadId:    cached.threadId,
              from:        cached.sender || cached.from,
              sender:      cached.sender || cached.from,
              senderEmail: cached.senderEmail || _parseBareEmail(cached.sender || cached.from),
              to:          cached.to || (cached.recipients || []).join(', '),
              recipients:  cached.recipients || [cached.to],
              subject:     cached.subject,
              snippet:     cached.snippet,
              bodyText:    cached.bodyText || '',
              bodyHtml:    cached.bodyHtml || '',
              internalDate: cached.internalDate || (cached.receivedAt ? new Date(cached.receivedAt).getTime() : 0),
              date:        cached.receivedAt || cached.date || cached.createdAt,
              receivedAt:  cached.receivedAt || cached.date || cached.createdAt,
              labelIds:    cached.labels || [],
              isRead:      cached.isRead,
            })
          }
          return this._fetchFullMessage(id)
        })
      )
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value)
      }
    }

    const sortedEmails = results.sort((a, b) => {
      const timeA = Number(a.internalDate) || (a.receivedAt ? new Date(a.receivedAt).getTime() : (a.date ? new Date(a.date).getTime() : 0))
      const timeB = Number(b.internalDate) || (b.receivedAt ? new Date(b.receivedAt).getTime() : (b.date ? new Date(b.date).getTime() : 0))
      return timeB - timeA
    })

    return {
      emails: sortedEmails,
      nextPageToken,
      resultSizeEstimate,
      hasMore: Boolean(nextPageToken),
    }
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /*  Public API                                                      */
  /* ═══════════════════════════════════════════════════════════════ */

  async getInbox(options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: ['INBOX'] })
  }

  async getSent(options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: ['SENT'] })
  }

  async getStarred(options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: ['STARRED'] })
  }

  async getDrafts(options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: ['DRAFT'] })
  }

  async getTrash(options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: ['TRASH'], includeSpamTrash: true })
  }

  async getSpam(options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: ['SPAM'], includeSpamTrash: true })
  }

  async getImportant(options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: ['IMPORTANT'] })
  }

  async getUnread(options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: ['UNREAD'] })
  }

  async getCategory(categoryName, options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: [categoryName] })
  }

  async getCustomLabel(labelId, options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: [labelId] })
  }

  async getSnoozed(options = {}) {
    try {
      return await this._listAndHydrate(null, { ...options, q: 'is:snoozed' })
    } catch {
      return this._listAndHydrate(null, { ...options, labelIds: ['SNOOZED'] })
    }
  }

  async getLabelMessages(labelId, options = {}) {
    return this._listAndHydrate(null, { ...options, labelIds: [labelId] })
  }

  async searchMessages(query, options = {}) {
    return this._listAndHydrate(null, { ...options, q: query })
  }

  /**
   * sendMessage({ to, subject, body }) → { id, threadId, email }
   * Composes and sends a new email via the Gmail API.
   */
  /**
   * sendMessage({ to, subject, body }) → { id, messageId, threadId, to, subject, verified, email }
   * Composes, sends, and verifies a new email via the Gmail API.
   */
  async sendMessage({ to, subject, body = '', html }) {
    console.log(`[AI SEND] Request recipient(s): ${to}`)
    console.log(`[AI SEND] Request subject: ${subject}`)

    const cleanTo = parseAndValidateRecipients(to)

    const gmail = await this._getClient()

    let authenticatedAccount = this._user.email
    try {
      const profileRes = await gmail.users.getProfile({ userId: 'me' })
      if (profileRes.data?.emailAddress) {
        authenticatedAccount = profileRes.data.emailAddress
      }
    } catch (profErr) {
      console.warn('[AI SEND] Unable to fetch Gmail profile:', profErr.message)
    }

    console.log(`[AI SEND] Authenticated Gmail account: ${authenticatedAccount}`)
    console.log(`[AI SEND] Sending FROM: ${authenticatedAccount}`)
    console.log(`[AI SEND] Sending TO: ${cleanTo}`)

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AI SEND DIAGNOSTICS] Outgoing MIME Metadata:
  From: "${this._user?.name || ''}" <${authenticatedAccount}>
  To: ${cleanTo}
  Subject: ${subject || '(no subject)'}
  RFC 5322 Standards: Compliant (No custom/fake spam manipulation headers)`)
    }

    const raw = _buildRawEmail({
      from: authenticatedAccount,
      to: cleanTo,
      subject: subject || '(no subject)',
      body,
      html,
      user: this._user,
    })

    console.log(`[AI SEND] Calling Gmail API...`)

    let res
    try {
      res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      })
    } catch (sendErr) {
      console.error('[AI SEND] Gmail API send failed:', sendErr.message, sendErr.code, sendErr.status)
      const errDetail = sendErr.response?.data?.error?.message || sendErr.message || 'Gmail API send error'
      throw new Error(`Gmail API send failed: ${errDetail}`)
    }

    const returnedMessageId = res.data?.id
    console.log(`[AI SEND] Gmail response status: ${res.status || 200}`)
    console.log(`[AI SEND] Gmail message ID: ${returnedMessageId}`)

    if (!returnedMessageId) {
      console.error('[AI SEND] Gmail API returned empty message ID.')
      throw new Error('Gmail API returned success status but no message ID was received.')
    }

    console.log(`[AI SEND] Verifying sent message metadata in Gmail...`)
    let verifiedMessage = null
    try {
      const getRes = await gmail.users.messages.get({
        userId: 'me',
        id: returnedMessageId,
        format: 'metadata',
        metadataHeaders: ['To', 'Subject', 'From'],
      })
      verifiedMessage = getRes.data
    } catch (getErr) {
      console.error('[AI SEND] Verification error: Message not retrievable from Gmail:', getErr.message)
      throw new Error(`Sent message verification failed: Gmail could not confirm message ${returnedMessageId}.`)
    }

    const labelIds = verifiedMessage.labelIds || []
    const hasSentLabel = labelIds.includes('SENT')
    console.log(`[AI SEND] Gmail labels: ${labelIds.join(', ')}`)
    console.log(`[AI SEND] Verification result: hasSentLabel=${hasSentLabel}`)

    if (!hasSentLabel) {
      console.error(`[AI SEND] Verification failed: SENT label missing from message ${returnedMessageId}.`)
      throw new Error(`Message ${returnedMessageId} sent, but SENT label is missing in Gmail.`)
    }

    const email = await this._fetchFullMessage(returnedMessageId)

    if (email && Array.isArray(email.labels) && !email.labels.includes('SENT')) {
      email.labels.push('SENT')
      await dbOp(() => EmailCache.updateOne(
        { userId: this._user._id, gmailId: returnedMessageId },
        { $addToSet: { labels: 'SENT' } }
      )).catch(() => {})
    }

    console.log(`[AI SEND] FINAL RESULT: SUCCESS`)
    return {
      success: true,
      id: returnedMessageId,
      messageId: returnedMessageId,
      threadId: res.data.threadId,
      to: cleanTo,
      subject,
      verified: true,
      email,
    }
  }

  /**
   * createDraft({ to, subject, body }) → { id, message }
   * Saves a draft in Gmail without sending it.
   */
  async createDraft({ to, subject, body = '', html }) {
    const gmail = await this._getClient()
    const cleanTo = to ? parseAndValidateRecipients(to) : ''
    const raw   = _buildRawEmail({ from: this._user.email, to: cleanTo, subject, body, html, user: this._user })

    const res = await gmail.users.drafts.create({
      userId:      'me',
      requestBody: { message: { raw } },
    })

    console.log(`[GmailService] createDraft — draftId: ${res.data.id}`)
    return { id: res.data.id, message: res.data.message }
  }

  /**
   * sendDraft(draftId) → { id, threadId, email }
   * Sends a previously saved draft.
   */
  async sendDraft(draftId) {
    const gmail = await this._getClient()

    console.log(`[AI DRAFT SEND] Sending draft: ${draftId}`)
    let res
    try {
      res = await gmail.users.drafts.send({
        userId:      'me',
        requestBody: { id: draftId },
      })
    } catch (sendErr) {
      console.error('[AI DRAFT SEND] Gmail API draft send failed:', sendErr.message)
      throw new Error(`Gmail API draft send failed: ${sendErr.message}`)
    }

    const returnedMessageId = res.data?.id
    if (!returnedMessageId) {
      throw new Error('Gmail API returned no message ID on draft send.')
    }

    const getRes = await gmail.users.messages.get({
      userId: 'me', id: returnedMessageId, format: 'metadata',
      metadataHeaders: ['To', 'Subject'],
    })
    const labelIds = getRes.data?.labelIds || []
    if (!labelIds.includes('SENT')) {
      throw new Error(`Draft message ${returnedMessageId} missing SENT label.`)
    }

    const email = await this._fetchFullMessage(returnedMessageId)
    console.log(`[AI DRAFT SEND] FINAL RESULT: SUCCESS`)

    return {
      success: true,
      id: returnedMessageId,
      messageId: returnedMessageId,
      threadId: res.data.threadId,
      verified: true,
      email,
    }
  }

  /**
   * replyToMessage(messageId, { body, html }) → { id, threadId, email }
   * Sends an inline reply to an existing message in the same thread.
   */
  async replyToMessage(messageId, { body = '', html }) {
    const gmail = await this._getClient()

    const origRes = await gmail.users.messages.get({
      userId: 'me', id: messageId, format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Message-ID'],
    })

    const origHeaders = origRes.data.payload?.headers || []
    const origSubject = _getHeader(origHeaders, 'subject')
    const origFrom    = _getHeader(origHeaders, 'from')
    const origMsgId   = _getHeader(origHeaders, 'message-id')
    const threadId    = origRes.data.threadId

    const targetTo = _parseBareEmail(origFrom)
    console.log(`[AI REPLY] Request recipient: ${targetTo}`)

    let authenticatedAccount = this._user.email
    try {
      const profileRes = await gmail.users.getProfile({ userId: 'me' })
      if (profileRes.data?.emailAddress) {
        authenticatedAccount = profileRes.data.emailAddress
      }
    } catch (_) {}

    const replySubject = origSubject.toLowerCase().startsWith('re:')
      ? origSubject
      : `Re: ${origSubject}`

    const raw = _buildRawEmail({
      from:             authenticatedAccount,
      to:               targetTo,
      subject:          replySubject,
      body,
      html,
      replyToMessageId: origMsgId ? origMsgId.replace(/[<>]/g, '') : undefined,
      user:             this._user,
    })

    console.log(`[AI REPLY] Calling Gmail API (users.messages.send)...`)
    let res
    try {
      res = await gmail.users.messages.send({
        userId:      'me',
        requestBody: { raw, threadId },
      })
    } catch (sendErr) {
      console.error('[AI REPLY] Gmail API reply failed:', sendErr.message)
      throw new Error(`Gmail API reply failed: ${sendErr.message}`)
    }

    const returnedMessageId = res.data?.id
    if (!returnedMessageId) {
      throw new Error('Gmail API returned no message ID on reply.')
    }

    const getRes = await gmail.users.messages.get({
      userId: 'me', id: returnedMessageId, format: 'metadata',
      metadataHeaders: ['To', 'Subject'],
    })
    const labelIds = getRes.data?.labelIds || []
    if (!labelIds.includes('SENT')) {
      throw new Error(`Reply message ${returnedMessageId} missing SENT label.`)
    }

    const email = await this._fetchFullMessage(returnedMessageId)
    console.log(`[AI REPLY] FINAL RESULT: SUCCESS`)

    return {
      success: true,
      id: returnedMessageId,
      messageId: returnedMessageId,
      threadId: res.data.threadId,
      to: targetTo,
      subject: replySubject,
      verified: true,
      email,
    }
  }

  /**
   * markAsRead(messageId) → void
   * Removes the UNREAD label from a Gmail message and updates cache.
   */
  async markAsRead(messageId) {
    const gmail = await this._getClient()

    await gmail.users.messages.modify({
      userId:      'me',
      id:          messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })

    await dbOp(() => EmailCache.updateOne(
      { userId: this._user._id, gmailId: messageId },
      { $set: { isRead: true } }
    ))

    console.log(`[GmailService] markAsRead — ${messageId}`)
  }

  /**
   * markAsUnread(messageId) → void
   * Adds the UNREAD label to a Gmail message and updates cache.
   */
  async markAsUnread(messageId) {
    const gmail = await this._getClient()

    await gmail.users.messages.modify({
      userId:      'me',
      id:          messageId,
      requestBody: { addLabelIds: ['UNREAD'] },
    })

    await dbOp(() => EmailCache.updateOne(
      { userId: this._user._id, gmailId: messageId },
      { $set: { isRead: false } }
    ))

    console.log(`[GmailService] markAsUnread — ${messageId}`)
  }

  /**
   * starMessage(messageId) → void
   */
  async starMessage(messageId) {
    const gmail = await this._getClient()
    await gmail.users.messages.modify({
      userId:      'me',
      id:          messageId,
      requestBody: { addLabelIds: ['STARRED'] },
    })
    await dbOp(() => EmailCache.updateOne(
      { userId: this._user._id, gmailId: messageId },
      { $addToSet: { labels: 'STARRED' } }
    ))
    console.log(`[GmailService] starMessage — ${messageId}`)
  }

  /**
   * unstarMessage(messageId) → void
   */
  async unstarMessage(messageId) {
    const gmail = await this._getClient()
    await gmail.users.messages.modify({
      userId:      'me',
      id:          messageId,
      requestBody: { removeLabelIds: ['STARRED'] },
    })
    await dbOp(() => EmailCache.updateOne(
      { userId: this._user._id, gmailId: messageId },
      { $pull: { labels: 'STARRED' } }
    ))
    console.log(`[GmailService] unstarMessage — ${messageId}`)
  }

  /**
   * archiveMessage(messageId) → void
   */
  async archiveMessage(messageId) {
    const gmail = await this._getClient()
    await gmail.users.messages.modify({
      userId:      'me',
      id:          messageId,
      requestBody: { removeLabelIds: ['INBOX'] },
    })
    await dbOp(() => EmailCache.updateOne(
      { userId: this._user._id, gmailId: messageId },
      { $pull: { labels: 'INBOX' } }
    ))
    console.log(`[GmailService] archiveMessage — ${messageId}`)
  }

  /**
   * trashMessage(messageId) → void
   */
  async trashMessage(messageId) {
    const gmail = await this._getClient()
    await gmail.users.messages.trash({
      userId: 'me',
      id:     messageId,
    })
    await dbOp(() => EmailCache.updateOne(
      { userId: this._user._id, gmailId: messageId },
      { $addToSet: { labels: 'TRASH' }, $pull: { labels: 'INBOX' } }
    ))
    console.log(`[GmailService] trashMessage — ${messageId}`)
  }

  /**
   * deleteDraft(draftId) → void
   */
  async deleteDraft(draftId) {
    const gmail = await this._getClient()
    await gmail.users.drafts.delete({
      userId: 'me',
      id:     draftId,
    })
    console.log(`[GmailService] deleteDraft — ${draftId}`)
  }

  /**
   * batchModifyMessages({ messageIds, addLabelIds, removeLabelIds }) → void
   */
  async batchModifyMessages({ messageIds = [], addLabelIds = [], removeLabelIds = [] }) {
    if (!messageIds.length) return
    const gmail = await this._getClient()
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messageIds,
        addLabelIds,
        removeLabelIds,
      },
    })
    const updateObj = {}
    if (addLabelIds.length) updateObj.$addToSet = { labels: { $each: addLabelIds } }
    if (removeLabelIds.length) updateObj.$pullAll = { labels: removeLabelIds }
    if (removeLabelIds.includes('UNREAD')) updateObj.$set = { isRead: true }
    if (addLabelIds.includes('UNREAD')) updateObj.$set = { isRead: false }

    await dbOp(() => EmailCache.updateMany(
      { userId: this._user._id, gmailId: { $in: messageIds } },
      updateObj
    ))
    console.log(`[GmailService] batchModifyMessages — ${messageIds.length} messages updated`)
  }

  /**
   * watchMailbox() → { historyId, expiration } | null
   * Registers a Gmail push-notification watch via Google Cloud Pub/Sub.
   * Persists historyId and watchExpiry on the user document.
   */
  /**
   * watchMailbox() → { historyId, expiration } | null
   * Registers a Gmail push-notification watch via Google Cloud Pub/Sub.
   * Persists historyId and watchExpiry on the user document.
   * Non-fatal: Catches and logs Pub/Sub errors safely without throwing.
   */
  async watchMailbox() {
    let topicName = process.env.GMAIL_PUBSUB_TOPIC
    if (!topicName && process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.PUBSUB_TOPIC_NAME) {
      topicName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/${process.env.PUBSUB_TOPIC_NAME}`
    }

    if (!topicName || topicName.includes('your-gcp-project-id')) {
      console.warn('[GMAIL WATCH] ⚠️ Pub/Sub config missing or using placeholder project ID — skipping watch.')
      console.warn('[GMAIL SYNC] Real-time watch unavailable; incremental sync remains available')
      this._user.isWatchAvailable = false
      await this._user.save().catch(() => {})
      return null
    }

    // Extract project ID from topic string for diagnostic logging
    let projectId = 'unknown'
    const projectMatch = topicName.match(/^projects\/([^/]+)\/topics\/(.+)$/)
    if (projectMatch) {
      projectId = projectMatch[1]
    } else if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
      projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
    }

    try {
      const gmail = await this._getClient()

      console.log(`[GMAIL WATCH] Attempting Gmail Pub/Sub watch with topic: ${topicName} (project: ${projectId})...`)

      const res = await gmail.users.watch({
        userId:      'me',
        requestBody: { topicName, labelIds: ['INBOX'] },
      })

      const { historyId, expiration } = res.data

      this._user.historyId          = historyId || this._user.historyId
      this._user.watchExpiry        = new Date(parseInt(expiration, 10))
      this._user.lastSync           = new Date()
      this._user.isWatchAvailable   = true
      this._user.watchError         = null
      await this._user.save().catch(() => {})

      console.log(`[GMAIL WATCH] ✅ Gmail Pub/Sub watch established successfully — historyId: ${historyId}, expires: ${this._user.watchExpiry.toISOString()}`)
      return res.data
    } catch (err) {
      const status  = err.status || err.code || err.response?.status || 500
      const errors  = err.errors || err.response?.data?.error?.errors || []
      const reason  = errors[0]?.reason || err.response?.data?.error?.status || err.code || 'UNKNOWN_ERROR'
      const message = err.message || err.response?.data?.error?.message || 'Gmail watch registration failed'

      console.warn(`[GMAIL WATCH] ⚠️ Failed to configure Gmail Pub/Sub watch`)
      console.warn(`[GMAIL WATCH] Status: ${status}`)
      console.warn(`[GMAIL WATCH] Google API Code: ${err.code || status}`)
      console.warn(`[GMAIL WATCH] Reason: ${reason}`)
      console.warn(`[GMAIL WATCH] Message: ${message}`)
      if (errors.length > 0) {
        console.warn(`[GMAIL WATCH] Details:`, JSON.stringify(errors))
      }
      console.warn(`[GMAIL WATCH] Pub/Sub Topic: ${topicName}`)
      console.warn(`[GMAIL WATCH] GCP Project ID: ${projectId}`)
      console.warn(`[GMAIL SYNC] Real-time watch unavailable; incremental sync remains available`)

      this._user.isWatchAvailable = false
      this._user.watchError = {
        status,
        reason,
        message,
        failedAt: new Date(),
      }
      await this._user.save().catch(() => {})

      // Return null safely instead of throwing error upward so mailbox sync succeeds
      return null
    }
  }

  /**
   * renewWatchIfNeeded() → void
   * Renews the Gmail watch subscription if it is missing or expiring within 24 h.
   * Respects 1-hour backoff lock if previous watch attempt failed.
   */
  async renewWatchIfNeeded() {
    if (this._user.watchError && this._user.watchError.failedAt) {
      const failedAtTime = new Date(this._user.watchError.failedAt).getTime()
      const oneHourAgo = Date.now() - 3600_000
      if (failedAtTime > oneHourAgo) {
        console.log(`[GMAIL WATCH] Skipping renewWatch — previous watch attempt failed within last 1 hour (reason: ${this._user.watchError.reason || 'watch failed'}).`)
        return null
      }
    }

    const now    = Date.now()
    const expiry = this._user.watchExpiry
      ? new Date(this._user.watchExpiry).getTime()
      : 0

    if (!expiry || expiry - now < 86_400_000) {
      console.log(`[GmailService] Renewing watch for ${this._user.email}…`)
      try {
        await this.watchMailbox()
      } catch (err) {
        console.warn(`[GMAIL WATCH] Non-fatal error during renewWatch: ${err.message}`)
      }
    }
  }

  /**
   * getHistory(startHistoryId) → { history[], historyId }
   * Calls the Gmail History API for incremental changes since startHistoryId.
   */
  async getHistory(startHistoryId) {
    const gmail = await this._getClient()

    const res = await gmail.users.history.list({
      userId:         'me',
      startHistoryId,
      historyTypes:   ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
      labelId:        'INBOX',
    })

    return {
      history:   res.data.history   || [],
      historyId: res.data.historyId || startHistoryId,
    }
  }

  async getMessage(messageId) {
    const email = await this._fetchFullMessage(messageId)
    await this.markAsRead(messageId).catch(() => {})
    return email
  }

  /**
   * performFullSync({ limit?, reason? }) → { emails, totalDiscovered, totalUpserted }
   * Discovers all Gmail labels and messages via listAllMessages (following nextPageToken to completion),
   * hydrates metadata/snippets into MongoDB EmailCache, and updates historyId.
   */
  async performFullSync(options = {}) {
    const reason = options.reason || 'USER_MANUAL_SYNC'

    const ALLOWED_FULL_SYNC_REASONS = [
      'USER_MANUAL_SYNC',
      'INITIAL_GMAIL_CONNECTION',
      'HISTORY_ID_EXPIRED',
      'RECOVERY',
    ]

    if (!ALLOWED_FULL_SYNC_REASONS.includes(reason)) {
      console.log(`[GMAIL SYNC TRIGGER] Blocked full sync request for ${this._user.email}. Reason "${reason}" is NOT allowed to start full sync.`)
      const inboxResult = await this.getInbox({ limit: options.limit || 50 })
      return {
        status: 'skipped',
        reason,
        message: `Full sync blocked for reason: ${reason}`,
        ...inboxResult,
      }
    }

    console.log(`[GMAIL SYNC TRIGGER] reason: ${reason}`)

    const userKey = this._user._id ? this._user._id.toString() : this._user.email
    if (activeSyncLocks.get(userKey)) {
      console.warn(`[GMAIL SYNC TRIGGER] Sync request ignored — full sync already running for ${this._user.email} (reason: ${reason})`)
      const inboxResult = await this.getInbox({ limit: options.limit || 50 })
      return {
        status: 'already_syncing',
        message: 'Gmail synchronization is already in progress.',
        ...inboxResult,
      }
    }

    activeSyncLocks.set(userKey, true)
    console.log(`[GMAIL SYNC] Starting full sync for user ${this._user.email} (reason: ${reason})...`)
    this._user.syncStatus = 'syncing'
    await this._user.save().catch(() => {})

    let messageIds = []
    let upsertedCount = 0
    let duplicatesSkipped = 0
    let failedCount = 0

    try {
      const gmail = await this._getClient()

      // 1. Discover and cache all labels
      const labels = await this.syncLabels()
      console.log(`[GMAIL SYNC] Labels discovered: ${labels.length}`)

      // 2. Discover all message IDs across mailbox (following nextPageToken to completion)
      messageIds = await this.listAllMessages({ maxPages: Infinity })
      console.log(`[GMAIL SYNC] Total discovered: ${messageIds.length}`)

      // 3. Hydrate & upsert in controlled concurrency batches with safe retry limits
      const BATCH = 25

      for (let i = 0; i < messageIds.length; i += BATCH) {
        const pageNum = Math.floor(i / BATCH) + 1
        const batch = messageIds.slice(i, i + BATCH)

        const settled = await Promise.allSettled(
          batch.map(async (id) => {
            const cached = await dbOp(() => EmailCache.findOne({ userId: this._user._id, gmailId: id }))
            if (cached) {
              duplicatesSkipped++
              return cached
            }
            return this._fetchFullMessage(id)
          })
        )

        for (const r of settled) {
          if (r.status === 'fulfilled' && r.value) {
            upsertedCount++
          } else {
            failedCount++
          }
        }

        console.log(`[GMAIL SYNC] Page ${pageNum}: ${batch.length} messages processed (Total upserted: ${upsertedCount})`)
      }

      // 4. Update profile historyId
      const profileRes = await gmail.users.getProfile({ userId: 'me' })
      const latestHistoryId = profileRes.data.historyId

      const now = new Date()
      this._user.historyId = latestHistoryId
      this._user.lastSync = now
      this._user.lastFullSyncAt = now
      this._user.syncStatus = 'completed'
      this._user.totalMessagesSynced = upsertedCount
      await this._user.save().catch(() => {})

      // 5. Attempt Gmail watch renewal non-fatally
      try {
        await this.renewWatchIfNeeded()
      } catch (watchErr) {
        console.warn(`[GMAIL WATCH] Non-fatal watch renewal warning: ${watchErr.message}`)
      }

      console.log(`[GMAIL SYNC] Mailbox synchronization completed successfully`)
      console.log(`[GMAIL SYNC] FULL SYNC COMPLETE`)
      console.log(`[GMAIL SYNC] totalFetched: ${messageIds.length}`)
      console.log(`[GMAIL SYNC] totalUpserted: ${upsertedCount}`)
      console.log(`[GMAIL SYNC] duplicatesSkipped: ${duplicatesSkipped}`)
      console.log(`[GMAIL SYNC] failed: ${failedCount}`)

      // Emit single sync:complete event on real full sync completion
      try {
        const socketModule = require('../socket/socket')
        const stats = { status: 'completed', totalFetched: messageIds.length, totalUpserted: upsertedCount, count: upsertedCount }
        if (this._user.email) socketModule.emitSyncComplete(this._user.email, stats)
        if (this._user._id)   socketModule.emitSyncComplete(this._user._id.toString(), stats)
      } catch (_) {}

      const inboxResult = await this.getInbox({ limit: options.limit || 50 })
      return {
        ...inboxResult,
        status: 'completed',
        totalDiscovered: messageIds.length,
        totalUpserted: upsertedCount,
      }
    } catch (err) {
      console.error(`[GMAIL SYNC] Full sync failed for ${this._user.email}:`, err.message)
      this._user.syncStatus = 'failed'
      await this._user.save().catch(() => {})
      throw err
    } finally {
      activeSyncLocks.delete(userKey)
    }
  }

  /**
   * performInitialSync(limit?, reason?) → { emails, nextPageToken, resultSizeEstimate, hasMore }
   */
  async performInitialSync(limit = 50, reason = 'INITIAL_GMAIL_CONNECTION') {
    console.log(`[GMAIL SYNC TRIGGER] Starting INITIAL SYNC for user ${this._user.email} (reason: ${reason})...`)
    return this.performFullSync({ limit, reason })
  }

  /**
   * performIncrementalSync(incomingHistoryId) → { messages: ApplicationEmail[], resynced: boolean, historyId }
   * Uses Gmail History API to find new messages since last sync.
   * Falls back to full resync if historyId is stale/invalid.
   */
  async performIncrementalSync(incomingHistoryId) {
    const startHistoryId = this._user.historyId || incomingHistoryId

    if (!startHistoryId) {
      console.warn(`[GMAIL SYNC TRIGGER] No startHistoryId for ${this._user.email} — triggering initial full sync.`)
      await this.performFullSync({ reason: 'INITIAL_GMAIL_CONNECTION' })
      return { messages: [], resynced: true }
    }

    try {
      const { history, historyId: latestHistoryId } = await this.getHistory(startHistoryId)

      // Collect IDs of newly added inbox messages
      const addedIds = []
      for (const record of history) {
        for (const item of record.messagesAdded || []) {
          addedIds.push(item.message.id)
        }
      }

      // Hydrate each new message
      const newEmails = []
      for (const id of addedIds) {
        try {
          newEmails.push(await this._fetchFullMessage(id))
        } catch (err) {
          console.error(`[GmailService] Failed to fetch message ${id}:`, err.message)
        }
      }

      this._user.historyId = latestHistoryId
      this._user.lastSync  = new Date()
      await this._user.save().catch(() => {})

      console.log(`[GmailService] INCREMENTAL SYNC complete — ${newEmails.length} new message(s), historyId: ${latestHistoryId}`)
      return { messages: newEmails, resynced: false, historyId: latestHistoryId }

    } catch (err) {
      const isStale =
        err.code === 404 ||
        err.code === 400 ||
        err.message?.includes('historyId') ||
        err.errors?.[0]?.reason === 'historyIdNotFound'

      if (isStale) {
        console.warn(`[GMAIL SYNC TRIGGER] ⚠️ Stale historyId (${startHistoryId}) for ${this._user.email} — historyId expired, full resync triggered.`)
        await this.performFullSync({ reason: 'HISTORY_ID_EXPIRED' })
        return { messages: [], resynced: true }
      }

      throw err
    }
  }

  /**
   * autoSyncMailbox() → { mode: 'full'|'incremental', resynced: boolean, newMessagesCount: number }
   * Automatic synchronization entry point invoked when user session starts.
   * Performs INITIAL_GMAIL_CONNECTION full sync if account was never synced,
   * otherwise performs fast incremental sync using historyId.
   */
  async autoSyncMailbox() {
    const userKey = this._user._id ? this._user._id.toString() : this._user.email
    if (activeSyncLocks.get(userKey)) {
      console.log(`[GMAIL AUTO SYNC] Lock active — sync already in progress for ${this._user.email}`)
      return { status: 'already_syncing', mode: 'locked', newMessagesCount: 0 }
    }

    const hasCompletedInitial = Boolean(this._user.historyId && this._user.lastFullSyncAt)

    if (!hasCompletedInitial) {
      console.log(`[GMAIL AUTO SYNC] First-time connection detected for ${this._user.email} — triggering initial full sync.`)
      const fullRes = await this.performFullSync({ limit: 100, reason: 'INITIAL_GMAIL_CONNECTION' })
      return {
        success: true,
        mode: 'full',
        resynced: false,
        newMessagesCount: fullRes.totalUpserted || 0,
        stats: fullRes,
      }
    }

    console.log(`[GMAIL AUTO SYNC] Running incremental history sync for ${this._user.email} (startHistoryId: ${this._user.historyId})...`)
    try {
      const incRes = await this.performIncrementalSync(this._user.historyId)
      return {
        success: true,
        mode: incRes.resynced ? 'full' : 'incremental',
        resynced: incRes.resynced,
        newMessagesCount: (incRes.messages || []).length,
        messages: incRes.messages || [],
      }
    } catch (err) {
      console.error(`[GMAIL AUTO SYNC] Incremental sync error for ${this._user.email}:`, err.message)
      throw err
    }
  }

  /**
   * getCachedMailbox({ labelId, limit, page, query })
   * Fast MongoDB cache reader for immediate UI display.
   * Always sorts newest emails first (internalDate: -1).
   */
  async getCachedMailbox({ labelId = 'INBOX', limit = 50, page = 1, query = null } = {}) {
    if (!EmailCache) return { emails: [], totalDiscovered: 0, hasMore: false }

    const skip = Math.max(0, (page - 1) * limit)
    const filter = { userId: this._user._id }
    if (labelId && labelId !== 'all') {
      filter.labels = labelId
    }
    if (query) {
      filter.$or = [
        { subject: { $regex: query, $options: 'i' } },
        { snippet: { $regex: query, $options: 'i' } },
        { sender: { $regex: query, $options: 'i' } },
        { from: { $regex: query, $options: 'i' } },
      ]
    }

    const [rawDocs, total] = await Promise.all([
      dbOp(() => EmailCache.find(filter).sort({ internalDate: -1 }).skip(skip).limit(limit).lean()),
      dbOp(() => EmailCache.countDocuments(filter)),
    ])

    const emails = (rawDocs || []).map(normalizeMessage)
    return {
      emails,
      totalDiscovered: total || 0,
      hasMore: (skip + emails.length) < (total || 0),
    }
  }

  async getMailInsights() {
    const { generateAIInsights } = require('./ai.service')
    return generateAIInsights({ userId: this._user._id, userEmail: this._user.email })
  }
}

/* ─────────────────────────────────────────────────────────────── */
/* Exports                                                          */
/* ─────────────────────────────────────────────────────────────── */

/**
 * Factory — preferred entry point for controllers/routes.
 *
 * Usage:
 *   const svc = gmailService(req.user)
 *   const emails = await svc.getInbox()
 */
function gmailService(user) {
  return new GmailService(user)
}

// Also export the normalizer and the class for tests / special cases
module.exports = {
  gmailService,          // factory (preferred)
  GmailService,          // class (for tests)
  normalizeMessage,      // pure normalizer (used in webhook)
  parseAndValidateRecipients, // helper for multi-recipient parsing
}
