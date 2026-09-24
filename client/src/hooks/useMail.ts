import { useApp } from '../context/AppContext'

/**
 * Custom hook providing email-related state and API action methods
 */
export function useMail() {
  const {
    inboxEmails,
    sentEmails,
    displayedEmails,
    openedEmail,
    loadingInbox,
    loadingSent,
    sendingEmail,
    fetchInbox,
    fetchSent,
    openEmail,
    sendEmail,
    searchEmails,
  } = useApp()

  return {
    inboxEmails,
    sentEmails,
    displayedEmails,
    openedEmail,
    loadingInbox,
    loadingSent,
    sendingEmail,
    fetchInbox,
    fetchSent,
    openEmail,
    sendEmail,
    searchEmails,
  }
}
