import { Request, Response } from 'express'
import {
  fetchEmails,
  fetchEmailById,
  sendEmail,
  searchEmails,
  markAsRead,
  checkAndRenewWatch,
  performInitialSync,
} from '../services/gmail/gmail.service'
import { env } from '../config/env'

function normalizeEmail(doc: any) {
  if (!doc) return null
  const obj = doc?.toObject ? doc.toObject() : doc
  return {
    id:       obj.gmailId || obj.id || obj._id?.toString(),
    threadId: obj.threadId || '',
    from:     obj.from    || '',
    to:       obj.to      || '',
    subject:  obj.subject || '(no subject)',
    snippet:  obj.snippet || '',
    date:     obj.date    || null,
    isRead:   obj.isRead  ?? true,
    labels:   obj.labels  || [],
    bodyText: obj.bodyText || '',
    bodyHtml: obj.bodyHtml || '',
  }
}

export async function getInbox(req: Request, res: Response) {
  try {
    const user = req.user as any
    await checkAndRenewWatch(user).catch(() => {})

    let emails
    if (!user.historyId || !user.lastSync) {
      emails = await performInitialSync(user)
    } else {
      emails = await fetchEmails(user, 'in:inbox', 30)
    }
    res.json({ emails: emails.map(normalizeEmail) })
  } catch (err: any) {
    console.error('[EmailController] inbox error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

export async function getSent(req: Request, res: Response) {
  try {
    const user = req.user as any
    const emails = await fetchEmails(user, 'in:sent', 30)
    res.json({ emails: emails.map(normalizeEmail) })
  } catch (err: any) {
    console.error('[EmailController] sent error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

export async function getComplaints(req: Request, res: Response) {
  try {
    const user = req.user as any
    const label = env.GMAIL_COMPLAINTS_LABEL || 'Complaints'
    const emails = await fetchEmails(user, `label:${label}`, 50)
    res.json({ emails: emails.map(normalizeEmail) })
  } catch (err: any) {
    console.error('[EmailController] complaints error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

export async function search(req: Request, res: Response) {
  const { q } = req.query
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ message: 'Search query parameter "q" is required.' })
  }
  try {
    const user = req.user as any
    const emails = await searchEmails(user, q)
    res.json({ emails: emails.map(normalizeEmail) })
  } catch (err: any) {
    console.error('[EmailController] search error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

export async function send(req: Request, res: Response) {
  const { to, subject, body, html, threadId, inReplyTo, references } = req.body
  try {
    const user = req.user as any
    const result = await sendEmail(user, {
      to,
      subject,
      body: body || '',
      html,
      threadId,
      inReplyTo,
      references,
    })
    res.json({ success: true, messageId: result.id })
  } catch (err: any) {
    console.error('[EmailController] send error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const user = req.user as any
    const email = await fetchEmailById(user, req.params.id)
    res.json({ email: normalizeEmail(email) })
  } catch (err: any) {
    console.error('[EmailController] getById error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

export async function markRead(req: Request, res: Response) {
  try {
    const user = req.user as any
    await markAsRead(user, req.params.id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
}
