import { performIncrementalSync, performInitialSync } from '../gmail/gmail.sync.service'
import { emitToUser } from '../../socket/socket'

export async function processPushNotification(emailAddress: string, historyId: string) {
  const User = (await import('../../models/User')).default
  const user = await User.findOne({ email: emailAddress })
  if (!user) return

  const { messages, resynced } = await performIncrementalSync(user, historyId)

  if (resynced) {
    emitToUser(user.email, 'inbox-resynced', {})
    return
  }

  for (const msg of messages) {
    emitToUser(user.email, 'new-email', msg)
    emitToUser(user.email, 'mail:new', msg)
  }
}
