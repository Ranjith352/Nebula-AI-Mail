import { getGmailClient, fetchEmails, fetchEmailById } from './gmail.service'
import { env } from '../../config/env'

export async function watchInbox(user: any) {
  try {
    if (!env.GOOGLE_CLOUD_PROJECT_ID || !env.PUBSUB_TOPIC_NAME) {
      console.warn('[Gmail Watch] Google Cloud Pub/Sub missing. Skipping watch.')
      return null
    }

    const gmail = await getGmailClient(user)
    const topicName = `projects/${env.GOOGLE_CLOUD_PROJECT_ID}/topics/${env.PUBSUB_TOPIC_NAME}`

    const res = await gmail.users.watch({
      userId:      'me',
      requestBody: { topicName, labelIds: ['INBOX'] },
    })

    const { historyId, expiration } = res.data

    if (user.save) {
      user.historyId   = historyId || user.historyId
      user.watchExpiry = new Date(parseInt(expiration))
      user.lastSync    = new Date()
      await user.save().catch(() => {})
    }

    console.log(`[Gmail Watch] Registered for ${user.email}. historyId: ${historyId}`)
    return res.data
  } catch (err: any) {
    console.error('[Gmail Watch] Watch failed:', err.message)
    return null
  }
}

export async function checkAndRenewWatch(user: any) {
  if (!user) return
  const now = Date.now()
  const expiry = user.watchExpiry ? new Date(user.watchExpiry).getTime() : 0

  if (!expiry || expiry - now < 86400000) {
    await watchInbox(user)
  }
}

export async function performInitialSync(user: any) {
  console.log(`[Gmail Sync] Performing INITIAL SYNC for ${user.email}...`)
  const gmail = await getGmailClient(user)

  const profileRes = await gmail.users.getProfile({ userId: 'me' })
  const latestHistoryId = profileRes.data.historyId

  const emails = await fetchEmails(user, 'in:inbox', 30)

  if (user.save) {
    user.historyId = latestHistoryId
    user.lastSync  = new Date()
    await user.save().catch(() => {})
  }

  await checkAndRenewWatch(user)
  return emails
}

export async function performIncrementalSync(user: any, incomingHistoryId: string) {
  const startHistoryId = user.historyId || incomingHistoryId

  if (!startHistoryId) {
    await performInitialSync(user)
    return { messages: [], resynced: true }
  }

  try {
    const gmail = await getGmailClient(user)

    const res = await gmail.users.history.list({
      userId:       'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      labelId:      'INBOX',
    })

    const historyRecord = res.data.history || []
    const addedMessages: any[] = []

    for (const record of historyRecord) {
      for (const item of record.messagesAdded || []) {
        addedMessages.push(item.message)
      }
    }

    const latestHistoryId = res.data.historyId || incomingHistoryId

    const newEmails: any[] = []
    for (const msg of addedMessages) {
      try {
        const fullMsg = await fetchEmailById(user, msg.id)
        newEmails.push(fullMsg)
      } catch (err: any) {
        console.error(`[Gmail Sync] Failed message fetch ${msg.id}:`, err.message)
      }
    }

    if (user.save) {
      user.historyId = latestHistoryId
      user.lastSync  = new Date()
      await user.save().catch(() => {})
    }

    return { messages: newEmails, resynced: false, historyId: latestHistoryId }
  } catch (err: any) {
    const isStaleHistory =
      err.code === 404 ||
      err.code === 400 ||
      err.message?.includes('historyId') ||
      err.errors?.[0]?.reason === 'historyIdNotFound'

    if (isStaleHistory) {
      console.warn(`[Gmail Sync] Stale historyId detected for ${user.email}. Performing full resync.`)
      await performInitialSync(user)
      return { messages: [], resynced: true }
    }

    throw err
  }
}
