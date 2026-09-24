import { Request, Response } from 'express'
import User from '../models/User'
import { performIncrementalSync } from '../services/gmail/gmail.service'
import { emitToUser } from '../socket/socket'

export async function handleGmailPushNotification(req: Request, res: Response) {
  res.sendStatus(200)

  try {
    const message = req.body?.message
    if (!message?.data) return

    const decodedStr = Buffer.from(message.data, 'base64').toString('utf-8')
    const { emailAddress, historyId: incomingHistoryId } = JSON.parse(decodedStr)

    if (!emailAddress || !incomingHistoryId) return

    console.log(`[Webhook] Push notification received for ${emailAddress} — historyId: ${incomingHistoryId}`)

    const user = await User.findOne({ email: emailAddress })
    if (!user) return

    const { messages, resynced } = await performIncrementalSync(user, incomingHistoryId)

    if (resynced) {
      emitToUser(user.email, 'inbox-resynced', {})
      return
    }

    for (const emailData of messages) {
      const normalised = {
        id:       emailData.gmailId || emailData.id || (emailData as any)._id?.toString(),
        threadId: emailData.threadId,
        from:     emailData.from,
        to:       emailData.to,
        subject:  emailData.subject,
        snippet:  emailData.snippet,
        date:     emailData.date,
        isRead:   false,
        labels:   emailData.labels || [],
        bodyText: emailData.bodyText || '',
        bodyHtml: emailData.bodyHtml || '',
      }

      emitToUser(user.email, 'new-email', normalised)
      emitToUser(user.email, 'mail:new', normalised)
    }
  } catch (err: any) {
    console.error('[WebhookController] Processing error:', err.message)
  }
}
