import { google } from 'googleapis'
import { getGoogleOAuth2Client } from '../../config/google'
import { parseGmailMessage, ParsedEmail } from './gmail.parser'
import EmailCache from '../../models/EmailCache'

export async function getGmailClient(user: any) {
  const oAuth2Client = getGoogleOAuth2Client()
  oAuth2Client.setCredentials({
    access_token:  user.accessToken,
    refresh_token: user.refreshToken,
  })

  oAuth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      user.accessToken = tokens.access_token
      if (user.save) await user.save().catch(() => {})
    }
  })

  return google.gmail({ version: 'v1', auth: oAuth2Client })
}

export async function fetchEmails(user: any, query = 'in:inbox', maxResults = 30): Promise<ParsedEmail[]> {
  const gmail = await getGmailClient(user)

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  })

  const messages = listRes.data.messages || []
  if (messages.length === 0) return []

  const results: ParsedEmail[] = []
  const BATCH = 5

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH)
    const batchResults = await Promise.allSettled(
      batch.map(async ({ id }) => {
        if (!id) return null

        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'full',
        })

        const emailData = parseGmailMessage(msgRes.data)

        if (user._id) {
          await EmailCache.findOneAndUpdate(
            { userId: user._id, gmailId: id },
            { userId: user._id, ...emailData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          ).catch(() => {})
        }

        return emailData
      })
    )

    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value)
      }
    }
  }

  return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function fetchEmailById(user: any, gmailId: string): Promise<ParsedEmail> {
  const gmail = await getGmailClient(user)

  const msgRes = await gmail.users.messages.get({
    userId: 'me',
    id:     gmailId,
    format: 'full',
  })

  const emailData = parseGmailMessage(msgRes.data)

  if (user._id) {
    await EmailCache.findOneAndUpdate(
      { userId: user._id, gmailId },
      { userId: user._id, ...emailData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch(() => {})
  }

  await markAsRead(user, gmailId, gmail).catch(() => {})
  return emailData
}

function buildMimeMessage({
  fromName,
  fromEmail,
  to,
  subject,
  bodyText,
  bodyHtml,
  inReplyTo,
  references,
}: {
  fromName?: string
  fromEmail: string
  to: string
  subject: string
  bodyText: string
  bodyHtml?: string
  inReplyTo?: string
  references?: string
}): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const domain = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'gmail.com'
  const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 10)}@${domain}>`
  const cleanName = fromName ? fromName.replace(/["\r\n]/g, '').trim() : ''
  const formattedFrom = cleanName ? `"${cleanName}" <${fromEmail}>` : `<${fromEmail}>`
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`

  const plainText = bodyText || ''
  
  const htmlContent = bodyHtml || `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111827; background-color: #ffffff; margin: 0; padding: 12px;">
  ${plainText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>')}
</body>
</html>`

  const headers: string[] = [
    `From: ${formattedFrom}`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
  ]

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`)
  }
  if (references) {
    headers.push(`References: ${references}`)
  }

  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)

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

  return [
    headers.join('\r\n'),
    '',
    textPart,
    htmlPart,
    closingBoundary,
  ].join('\r\n')
}

export async function sendEmail(
  user: any,
  {
    to,
    subject,
    body = '',
    html,
    threadId,
    inReplyTo,
    references,
  }: {
    to: string
    subject: string
    body?: string
    html?: string
    threadId?: string
    inReplyTo?: string
    references?: string
  }
) {
  const gmail = await getGmailClient(user)

  const mimeString = buildMimeMessage({
    fromName: user.name || '',
    fromEmail: user.email,
    to,
    subject,
    bodyText: body,
    bodyHtml: html,
    inReplyTo,
    references,
  })

  const raw = Buffer.from(mimeString, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const requestBody: any = { raw }
  if (threadId) {
    requestBody.threadId = threadId
  }

  const res = await gmail.users.messages.send({
    userId:      'me',
    requestBody,
  })

  return res.data
}

export async function searchEmails(user: any, query: string): Promise<ParsedEmail[]> {
  return fetchEmails(user, query, 20)
}

export async function markAsRead(user: any, gmailId: string, existingClient?: any) {
  const gmail = existingClient || await getGmailClient(user)
  await gmail.users.messages.modify({
    userId:      'me',
    id:          gmailId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}

export * from './gmail.sync.service'
