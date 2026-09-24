const express  = require('express')
const { requireAuth } = require('../middleware/auth.middleware')
const { gmailService, parseAndValidateRecipients } = require('../services/gmail.service')
const {
  emitEmailSent,
  emitMailNew,
  emitMailUpdated,
  emitMailDeleted,
  emitSyncComplete,
} = require('../socket/socket')

const router = express.Router()

/* ─────────────────────────────────────────────────────────────── */
/* All routes require an authenticated session                      */
/* OAuth callback is handled in auth.routes.js (/auth/callback)   */
/* ─────────────────────────────────────────────────────────────── */
router.use(requireAuth)


function handleRouteError(err, res, fallbackMessage = 'Gmail service is temporarily unavailable.') {
  console.error('[Email Route Error]', err.stack || err.message)

  if (err.code === 404 || err.message?.includes('notFound') || err.message?.includes('not found')) {
    return res.status(404).json({ message: 'The requested email could not be found or has been deleted.' })
  }
  if (err.code === 401 || err.message?.includes('invalid_grant') || err.message?.includes('OAuth') || err.message?.includes('token')) {
    return res.status(401).json({ message: 'Your Google authorization has expired. Please log in again.' })
  }
  if (err.code === 400 || err.message?.includes('Invalid') || err.message?.includes('recipient')) {
    return res.status(400).json({ message: 'Failed to process email request. Please verify recipient details and try again.' })
  }

  return res.status(err.status || 500).json({ message: fallbackMessage })
}

const parsePagination = (req) => ({
  limit: parseInt(req.query.limit || '100', 10),
  pageToken: req.query.pageToken || null,
})

/* ── GET /api/labels ─────────────────────────────────────────── */
router.get('/labels', async (req, res) => {
  try {
    const svc = gmailService(req.user)
    const labels = await svc.syncLabels()
    res.json({ labels })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch labels.')
  }
})

/* ── GET /api/emails/insights ────────────────────────────────── */
router.get('/insights', async (req, res) => {
  try {
    const svc = gmailService(req.user)
    const insights = await svc.getMailInsights()
    res.json({ success: true, insights })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to generate AI insights.')
  }
})

/* ── GET /api/emails/inbox ───────────────────────────────────── */
router.get('/inbox', async (req, res) => {
  try {
    const svc = gmailService(req.user)
    await svc.renewWatchIfNeeded().catch(() => {})

    const params = parsePagination(req)
    
    // Fast path: load cached emails directly from MongoDB for immediate UI display
    const cachedResult = await svc.getCachedMailbox({ labelId: 'INBOX', limit: params.limit })
    if (cachedResult.emails && cachedResult.emails.length > 0) {
      return res.json(cachedResult)
    }

    // Fallback if DB cache is empty for first-time user
    let result
    if (!req.user.historyId && !req.user.lastFullSyncAt) {
      result = await svc.performInitialSync(params.limit, 'INITIAL_GMAIL_CONNECTION')
    } else {
      result = await svc.getInbox(params)
    }

    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch inbox emails.')
  }
})

/* ── POST /api/emails/sync/auto ─────────────────────────────── */
router.post('/sync/auto', async (req, res) => {
  try {
    const svc = gmailService(req.user)
    const result = await svc.autoSyncMailbox()

    if (result.newMessagesCount > 0) {
      if (req.user?.email) emitSyncComplete(req.user.email, { count: result.newMessagesCount, mode: result.mode })
      if (req.user?._id)   emitSyncComplete(req.user._id.toString(), { count: result.newMessagesCount, mode: result.mode })
    }

    res.json({ success: true, ...result })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to perform automatic background sync.')
  }
})

/* ── POST /api/emails/sync ───────────────────────────────────── */
router.post('/sync', async (req, res) => {
  try {
    const svc = gmailService(req.user)
    const params = parsePagination(req)
    const result = await svc.performFullSync({ limit: params.limit || 100, reason: 'USER_MANUAL_SYNC' })

    if (req.user?.email) emitSyncComplete(req.user.email, { count: result?.totalUpserted || result?.emails?.length || 0, isInitial: false })
    if (req.user?._id)   emitSyncComplete(req.user._id.toString(), { count: result?.totalUpserted || result?.emails?.length || 0, isInitial: false })

    res.json({ success: true, ...result })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to sync emails.')
  }
})

/* ── GET /api/emails/sent ────────────────────────────────────── */
router.get('/sent', async (req, res) => {
  try {
    const result = await gmailService(req.user).getSent(parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch sent emails.')
  }
})

/* ── GET /api/emails/starred ─────────────────────────────────── */
router.get('/starred', async (req, res) => {
  try {
    const result = await gmailService(req.user).getStarred(parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch starred emails.')
  }
})

/* ── GET /api/emails/drafts ──────────────────────────────────── */
router.get('/drafts', async (req, res) => {
  try {
    const result = await gmailService(req.user).getDrafts(parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch draft emails.')
  }
})

/* ── GET /api/emails/trash ───────────────────────────────────── */
router.get('/trash', async (req, res) => {
  try {
    const result = await gmailService(req.user).getTrash(parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch trash emails.')
  }
})

/* ── GET /api/emails/spam ────────────────────────────────────── */
router.get('/spam', async (req, res) => {
  try {
    const result = await gmailService(req.user).getSpam(parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch spam emails.')
  }
})

/* ── GET /api/emails/important ───────────────────────────────── */
router.get('/important', async (req, res) => {
  try {
    const result = await gmailService(req.user).getImportant(parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch important emails.')
  }
})

/* ── GET /api/emails/label/:labelId ──────────────────────────── */
router.get('/label/:labelId', async (req, res) => {
  try {
    const result = await gmailService(req.user).getLabelMessages(req.params.labelId, parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch label emails.')
  }
})

/* ── GET /api/emails/complaints ──────────────────────────────── */
router.get('/complaints', async (req, res) => {
  const label = process.env.GMAIL_COMPLAINTS_LABEL || 'Complaints'
  try {
    const result = await gmailService(req.user).searchMessages(`label:${label}`, parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch complaints.')
  }
})

/* ── GET /api/emails/thread/:threadId ───────────────────────── */
router.get('/thread/:threadId', async (req, res) => {
  try {
    const threadId = req.params.threadId
    const result = await gmailService(req.user).searchMessages(`threadId:${threadId}`, parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Failed to fetch email thread.')
  }
})

/* ── GET /api/emails/search?q= ───────────────────────────────── */
router.get('/search', async (req, res) => {
  const { q } = req.query
  if (!q) return res.status(400).json({ message: 'Search query "q" is required' })
  try {
    const result = await gmailService(req.user).searchMessages(q, parsePagination(req))
    res.json(result)
  } catch (err) {
    return handleRouteError(err, res, 'Search query failed.')
  }
})

/* ── POST /api/emails/send ───────────────────────────────────── */
router.post('/send', async (req, res) => {
  const { to, subject, body, html } = req.body

  if (!to || !subject) {
    return res.status(400).json({ success: false, error: 'Recipient ("to") and "subject" are required.', message: 'Recipient ("to") and "subject" are required.' })
  }

  // Recipient email syntax validation (supports single and multiple comma/semicolon-separated mail IDs)
  let cleanTo
  try {
    cleanTo = parseAndValidateRecipients(to)
  } catch (valErr) {
    return res.status(400).json({ success: false, error: valErr.message, message: valErr.message })
  }

  try {
    const result = await gmailService(req.user).sendMessage({ to: cleanTo, subject, body: body || '', html })
    const sentEmail = result.email

    console.log(`[Email Route] Sent to ${cleanTo} — Gmail message ID: ${result.id}, verified: ${result.verified}`)

    // Emit user-specific email:sent event
    const socketPayload = {
      messageId: result.id,
      to: cleanTo,
      subject,
      internalDate: sentEmail?.internalDate || Date.now(),
      labelIds: sentEmail?.labels || ['SENT'],
      email: sentEmail,
    }
    if (req.user.email) {
      emitEmailSent(req.user.email, socketPayload)
      emitMailNew(req.user.email, socketPayload)
    }
    if (req.user._id) {
      emitEmailSent(req.user._id.toString(), socketPayload)
      emitMailNew(req.user._id.toString(), socketPayload)
    }

    res.json({
      success: true,
      verified: true,
      messageId: result.id,
      to: to.trim(),
      subject,
      email: sentEmail,
      message: `Email successfully sent through Gmail to ${to.trim()}.`
    })
  } catch (err) {
    console.error('[Email Route Error] Send failed:', err.stack || err.message)
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to send email message.',
      message: err.message || 'Failed to send email message.',
      code: err.code || err.status || 500
    })
  }
})

/* ── POST /api/emails/draft ──────────────────────────────────── */
router.post('/draft', async (req, res) => {
  const { to, subject, body, html } = req.body

  if (!to || !subject) {
    return res.status(400).json({ message: 'Recipient ("to") and "subject" are required.' })
  }

  try {
    const draft = await gmailService(req.user).createDraft({ to, subject, body: body || '', html })
    res.json({ success: true, draftId: draft.id })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to create draft.')
  }
})

/* ── POST /api/emails/draft/:draftId/send ────────────────────── */
router.post('/draft/:draftId/send', async (req, res) => {
  try {
    const result = await gmailService(req.user).sendDraft(req.params.draftId)
    const sentEmail = result.email

    if (req.user.email) {
      emitEmailSent(req.user.email, sentEmail)
      emitMailNew(req.user.email, sentEmail)
    }
    if (req.user._id) {
      emitEmailSent(req.user._id.toString(), sentEmail)
      emitMailNew(req.user._id.toString(), sentEmail)
    }

    res.json({ success: true, messageId: result.id, email: sentEmail })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to send draft.')
  }
})

/* ── POST /api/emails/:id/reply ──────────────────────────────── */
router.post('/:id/reply', async (req, res) => {
  const { body, html } = req.body
  if (!body) return res.status(400).json({ message: 'Reply body text is required.' })

  try {
    const result = await gmailService(req.user).replyToMessage(req.params.id, { body, html })
    const sentEmail = result.email

    if (req.user.email) {
      emitEmailSent(req.user.email, sentEmail)
      emitMailUpdated(req.user.email, { id: req.params.id, replied: true })
    }
    if (req.user._id) {
      emitEmailSent(req.user._id.toString(), sentEmail)
      emitMailUpdated(req.user._id.toString(), { id: req.params.id, replied: true })
    }

    res.json({ success: true, messageId: result.id, email: sentEmail })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to send reply.')
  }
})

/* ── POST /api/emails/:id/read ───────────────────────────────── */
router.post('/:id/read', async (req, res) => {
  try {
    await gmailService(req.user).markAsRead(req.params.id)

    // Emit real-time mail:updated event
    const updatePayload = { id: req.params.id, isRead: true }
    if (req.user.email) emitMailUpdated(req.user.email, updatePayload)
    if (req.user._id)   emitMailUpdated(req.user._id.toString(), updatePayload)

    res.json({ success: true })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to mark email as read.')
  }
})

/* ── POST /api/emails/:id/unread ─────────────────────────────── */
router.post('/:id/unread', async (req, res) => {
  try {
    await gmailService(req.user).markAsUnread(req.params.id)

    // Emit real-time mail:updated event
    const updatePayload = { id: req.params.id, isRead: false }
    if (req.user.email) emitMailUpdated(req.user.email, updatePayload)
    if (req.user._id)   emitMailUpdated(req.user._id.toString(), updatePayload)

    res.json({ success: true })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to mark email as unread.')
  }
})

/* ── DELETE /api/emails/:id ──────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    const emailId = req.params.id

    // Emit real-time mail:deleted event
    if (req.user.email) emitMailDeleted(req.user.email, { id: emailId })
    if (req.user._id)   emitMailDeleted(req.user._id.toString(), { id: emailId })

    res.json({ success: true, id: emailId })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to delete email.')
  }
})

/* ── POST /api/emails/:id/star ───────────────────────────────── */
router.post('/:id/star', async (req, res) => {
  try {
    await gmailService(req.user).starMessage(req.params.id)
    const updatePayload = { id: req.params.id, isStarred: true }
    if (req.user.email) emitMailUpdated(req.user.email, updatePayload)
    if (req.user._id)   emitMailUpdated(req.user._id.toString(), updatePayload)
    res.json({ success: true })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to star email.')
  }
})

/* ── POST /api/emails/:id/unstar ─────────────────────────────── */
router.post('/:id/unstar', async (req, res) => {
  try {
    await gmailService(req.user).unstarMessage(req.params.id)
    const updatePayload = { id: req.params.id, isStarred: false }
    if (req.user.email) emitMailUpdated(req.user.email, updatePayload)
    if (req.user._id)   emitMailUpdated(req.user._id.toString(), updatePayload)
    res.json({ success: true })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to unstar email.')
  }
})

/* ── POST /api/emails/:id/archive ────────────────────────────── */
router.post('/:id/archive', async (req, res) => {
  try {
    await gmailService(req.user).archiveMessage(req.params.id)
    if (req.user.email) emitMailDeleted(req.user.email, { id: req.params.id })
    if (req.user._id)   emitMailDeleted(req.user._id.toString(), { id: req.params.id })
    res.json({ success: true })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to archive email.')
  }
})

/* ── DELETE /api/emails/draft/:draftId ────────────────────────── */
router.delete('/draft/:draftId', async (req, res) => {
  try {
    await gmailService(req.user).deleteDraft(req.params.draftId)
    res.json({ success: true })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to delete draft.')
  }
})

/* ── POST /api/emails/batch-modify ───────────────────────────── */
router.post('/batch-modify', async (req, res) => {
  const { ids, action } = req.body
  if (!Array.isArray(ids) || !ids.length || !action) {
    return res.status(400).json({ message: 'Message "ids" array and "action" string are required.' })
  }

  try {
    let addLabelIds = []
    let removeLabelIds = []
    if (action === 'read') removeLabelIds = ['UNREAD']
    else if (action === 'unread') addLabelIds = ['UNREAD']
    else if (action === 'star') addLabelIds = ['STARRED']
    else if (action === 'unstar') removeLabelIds = ['STARRED']
    else if (action === 'archive') removeLabelIds = ['INBOX']
    else if (action === 'trash') addLabelIds = ['TRASH']

    await gmailService(req.user).batchModifyMessages({ messageIds: ids, addLabelIds, removeLabelIds })
    res.json({ success: true, count: ids.length })
  } catch (err) {
    return handleRouteError(err, res, 'Batch operation failed.')
  }
})

/* ── GET /api/emails/:id ─────────────────────────────────────── */
/* Must be LAST to avoid matching /inbox, /sent, etc.            */
router.get('/:id', async (req, res) => {
  try {
    const email = await gmailService(req.user).getMessage(req.params.id)
    if (!email) {
      return res.status(404).json({ message: 'The requested email could not be found or has been deleted.' })
    }
    res.json({ email })
  } catch (err) {
    return handleRouteError(err, res, 'Failed to load email details.')
  }
})

module.exports = router

