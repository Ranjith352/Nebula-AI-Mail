export interface ParsedEmail {
  gmailId: string
  threadId: string
  from: string
  to: string
  subject: string
  snippet: string
  date: Date
  isRead: boolean
  labels: string[]
  bodyText: string
  bodyHtml: string
}

export function parseGmailMessage(messageData: any): ParsedEmail {
  const headers = messageData.payload?.headers || []

  const getHeader = (name: string): string => {
    const h = headers.find((item: any) => item.name?.toLowerCase() === name.toLowerCase())
    return h ? h.value : ''
  }

  const from    = getHeader('From')
  const to      = getHeader('To')
  const subject = getHeader('Subject') || '(no subject)'
  const dateRaw = getHeader('Date')
  const date    = dateRaw ? new Date(dateRaw) : new Date()

  const labels: string[] = messageData.labelIds || []
  const isRead = !labels.includes('UNREAD')

  let bodyText = ''
  let bodyHtml = ''

  function extractParts(part: any) {
    if (!part) return
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText += Buffer.from(part.body.data, 'base64url').toString('utf-8')
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml += Buffer.from(part.body.data, 'base64url').toString('utf-8')
    }
    if (part.parts && Array.isArray(part.parts)) {
      part.parts.forEach(extractParts)
    }
  }

  extractParts(messageData.payload)

  return {
    gmailId:  messageData.id,
    threadId: messageData.threadId,
    from,
    to,
    subject,
    snippet:  messageData.snippet || '',
    date,
    isRead,
    labels,
    bodyText: bodyText.trim() || messageData.snippet || '',
    bodyHtml: bodyHtml.trim() || bodyText.trim() || messageData.snippet || '',
  }
}
