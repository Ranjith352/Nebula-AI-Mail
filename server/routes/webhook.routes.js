'use strict'

/**
 * Webhook Routes — receives Gmail push notifications from Google Cloud Pub/Sub.
 *
 * Real-Time Architecture Pipeline:
 *   Gmail
 *     │
 *     ▼
 *   Gmail Watch
 *     │
 *     ▼
 *   Google Pub/Sub
 *     │
 *     ▼
 *   Express Webhook (POST /api/webhook/gmail)
 *     │
 *     ▼
 *   historyId
 *     │
 *     ▼
 *   Gmail History API
 *     │
 *     ▼
 *   Sync Service
 *     ├──► MongoDB (EmailCache)
 *     └──► Socket.IO (User-Specific Room: io.to(`user:${userId}`).emit("mail:new", email))
 *            │
 *            ▼
 *          React (Inbox Update)
 *
 * PRIVACY GUARANTEE:
 * Private email events are NEVER broadcast to all sockets. Emitted strictly to the specific user's room.
 */

const express = require('express')
const User    = require('../models/User')
const { gmailService } = require('../services/gmail.service')
const { emitToUser } = require('../socket/socket')

const router = express.Router()

/* ── POST /api/webhook/gmail ─────────────────────────────────── */
router.post('/gmail', async (req, res) => {
  // Acknowledge immediately so Google Pub/Sub doesn't retry
  res.sendStatus(200)

  try {
    const message = req.body?.message
    if (!message?.data) return

    // Decode base64 Pub/Sub payload
    const decoded = Buffer.from(message.data, 'base64').toString('utf-8')
    const { emailAddress, historyId: incomingHistoryId } = JSON.parse(decoded)

    if (!emailAddress || !incomingHistoryId) return

    console.log(`[Webhook] Push received — email: ${emailAddress}, historyId: ${incomingHistoryId}`)

    // Resolve user from DB
    const user = await User.findOne({ email: emailAddress })
    if (!user) {
      console.warn(`[Webhook] No user found for: ${emailAddress}`)
      return
    }

    // Incremental sync via GmailService & History API
    const svc = gmailService(user)
    const { messages, resynced } = await svc.performIncrementalSync(incomingHistoryId)

    if (resynced) {
      // Full resync triggered — notify user room to refresh inbox
      emitToUser(user.email, 'inbox-resynced', {})
      emitToUser(user._id.toString(), 'inbox-resynced', {})
      return
    }

    // Emit new emails ONLY to the user's isolated room
    for (const email of messages) {
      emitToUser(user.email, 'mail:new', email)
      emitToUser(user._id.toString(), 'mail:new', email)
      emitToUser(user.email, 'new-email', email)
    }
  } catch (err) {
    console.error('[Webhook] Processing error:', err.message)
  }
})

module.exports = router
