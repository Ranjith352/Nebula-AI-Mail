import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import api from '../services/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  /* ── View state ───────────────────────────────────────────────── */
  const [currentView, setCurrentView] = useState('inbox') // inbox | sent | compose | detail | label:ID
  const [openedEmail, setOpenedEmail] = useState(null)

  /* ── Email lists & Pagination ────────────────────────────────── */
  const [inboxEmails, setInboxEmails] = useState([])
  const [sentEmails, setSentEmails] = useState([])
  const [displayedEmails, setDisplayedEmails] = useState([]) // currently displayed list
  const [labels, setLabels] = useState([]) // Gmail system & user labels
  const [mailboxPagination, setMailboxPagination] = useState({
    nextPageToken: null,
    resultSizeEstimate: 0,
    hasMore: false,
    loadingMore: false,
  })

  const [selectedEmailIds, setSelectedEmailIds] = useState(new Set())

  /* ── Compose form ─────────────────────────────────────────────── */
  const [composeData, setComposeData] = useState({ id: null, to: '', subject: '', body: '' })

  /* ── Loading / error / sync status ────────────────────────────── */
  const [loadingInbox, setLoadingInbox] = useState(false)
  const [loadingSent, setLoadingSent] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [syncStatusText, setSyncStatusText] = useState('Checking for new mail...')
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const [error, setError] = useState(null)

  /* ── Filter state ─────────────────────────────────────────────── */
  const [filters, setFilters] = useState({ unreadOnly: false, dateRange: 'all', sender: '', keyword: '' })

  /* ── User (auth) ──────────────────────────────────────────────── */
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  /* ── Notification ─────────────────────────────────────────────── */
  const [notification, setNotification] = useState(null) // { message, type }

  /* ─────────────────────────────────────────────────────────────── */
  /* Helpers                                                          */
  /* ─────────────────────────────────────────────────────────────── */
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3500)
  }, [])

  /* ─────────────────────────────────────────────────────────────── */
  /* Labels API                                                      */
  /* ─────────────────────────────────────────────────────────────── */
  const fetchLabels = useCallback(async () => {
    try {
      const { data } = await api.get('/api/emails/labels')
      if (data.labels) {
        setLabels(data.labels)
      }
    } catch (err) {
      console.error('[AppContext] Failed to fetch labels:', err.message)
    }
  }, [])

  /* ─────────────────────────────────────────────────────────────── */
  /* Auth                                                             */
  /* ─────────────────────────────────────────────────────────────── */
  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user)
      if (data.user) {
        fetchLabels()
      }
    } catch {
      setUser(null)
    } finally {
      setAuthChecked(true)
    }
  }, [fetchLabels])

  const logout = useCallback(async () => {
    await api.get('/auth/logout')
    setUser(null)
    setInboxEmails([])
    setSentEmails([])
    setDisplayedEmails([])
    setOpenedEmail(null)
    setLabels([])
    setMailboxPagination({ nextPageToken: null, resultSizeEstimate: 0, hasMore: false, loadingMore: false })
    setCurrentView('inbox')
  }, [])

  /* ─────────────────────────────────────────────────────────────── */
  /* Paginated Mailbox Fetcher                                        */
  /* ─────────────────────────────────────────────────────────────── */
  const fetchMailbox = useCallback(async (viewName = 'inbox', options = {}) => {
    const { pageToken = null, limit = 100, append = false, query = null } = options
    if (append) {
      setMailboxPagination(prev => ({ ...prev, loadingMore: true }))
    } else {
      setLoadingInbox(true)
    }
    setError(null)

    try {
      let endpoint = '/api/emails/inbox'
      const params = { limit }
      if (pageToken) params.pageToken = pageToken

      if (query) {
        endpoint = '/api/emails/search'
        params.q = query
      } else if (viewName === 'inbox') {
        endpoint = '/api/emails/inbox'
      } else if (viewName === 'sent') {
        endpoint = '/api/emails/sent'
      } else if (viewName === 'starred') {
        endpoint = '/api/emails/starred'
      } else if (viewName === 'drafts') {
        endpoint = '/api/emails/drafts'
      } else if (viewName === 'trash') {
        endpoint = '/api/emails/trash'
      } else if (viewName === 'spam' || viewName === 'complaints') {
        endpoint = '/api/emails/spam'
      } else if (viewName === 'important') {
        endpoint = '/api/emails/important'
      } else if (viewName.startsWith('label:')) {
        const labelId = viewName.replace('label:', '')
        endpoint = `/api/emails/label/${encodeURIComponent(labelId)}`
      } else if (viewName !== 'compose' && viewName !== 'detail' && viewName !== 'ai') {
        endpoint = `/api/emails/label/${encodeURIComponent(viewName)}`
      }

      const { data } = await api.get(endpoint, { params })
      const fetchedEmails = data.emails || []

      if (append) {
        setDisplayedEmails(prev => {
          const existingIds = new Set(prev.map(e => e.id || e.gmailMessageId))
          const newEmails = fetchedEmails.filter(e => !existingIds.has(e.id) && !existingIds.has(e.gmailMessageId))
          return [...prev, ...newEmails]
        })
        if (viewName === 'inbox') {
          setInboxEmails(prev => {
            const existingIds = new Set(prev.map(e => e.id || e.gmailMessageId))
            const newEmails = fetchedEmails.filter(e => !existingIds.has(e.id) && !existingIds.has(e.gmailMessageId))
            return [...prev, ...newEmails]
          })
        }
        if (viewName === 'sent') {
          setSentEmails(prev => {
            const existingIds = new Set(prev.map(e => e.id || e.gmailMessageId))
            const newEmails = fetchedEmails.filter(e => !existingIds.has(e.id) && !existingIds.has(e.gmailMessageId))
            return [...prev, ...newEmails]
          })
        }
      } else {
        setDisplayedEmails(fetchedEmails)
        if (viewName === 'inbox' && !query) setInboxEmails(fetchedEmails)
        if (viewName === 'sent' && !query) setSentEmails(fetchedEmails)
      }

      setMailboxPagination({
        nextPageToken: data.nextPageToken || null,
        resultSizeEstimate: data.resultSizeEstimate || 0,
        hasMore: Boolean(data.hasMore),
        loadingMore: false,
      })

      fetchLabels().catch(() => { })
      return data
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch mailbox emails'
      setError(msg)
      setMailboxPagination(prev => ({ ...prev, loadingMore: false }))
      return { emails: [], nextPageToken: null, hasMore: false }
    } finally {
      setLoadingInbox(false)
    }
  }, [fetchLabels])

  const loadMoreMailbox = useCallback(async () => {
    if (!mailboxPagination.hasMore || !mailboxPagination.nextPageToken || mailboxPagination.loadingMore) {
      return
    }
    await fetchMailbox(currentView, { pageToken: mailboxPagination.nextPageToken, append: true })
  }, [mailboxPagination, currentView, fetchMailbox])

  /* Legacy aliases for backward compatibility */
  const fetchInbox = useCallback(() => fetchMailbox('inbox'), [fetchMailbox])
  const fetchSent = useCallback(() => fetchMailbox('sent'), [fetchMailbox])

  const syncAll = useCallback(async () => {
    setLoadingInbox(true)
    setSyncStatusText('Running full Gmail sync...')
    showNotification('Starting full Gmail mailbox sync...', 'info')
    try {
      const { data } = await api.post('/api/emails/sync', { limit: 100 })
      if (data.emails) {
        setInboxEmails(data.emails)
        setDisplayedEmails(data.emails)
        setMailboxPagination({
          nextPageToken: data.nextPageToken || null,
          resultSizeEstimate: data.resultSizeEstimate || 0,
          hasMore: Boolean(data.hasMore),
          loadingMore: false,
        })
        const totalCount = data.totalDiscovered || data.totalUpserted || data.emails.length
        setSyncStatusText('Mailbox up to date')
        showNotification(`Full sync complete! (${totalCount} messages synchronized across account)`, 'success')
      }
    } catch (err) {
      setSyncStatusText('Sync failed')
      showNotification('Sync failed', 'error')
    } finally {
      setLoadingInbox(false)
    }
  }, [showNotification])

  /* ─────────────────────────────────────────────────────────────── */
  /* Automatic Background Gmail Sync (Invoked on session start)       */
  /* ─────────────────────────────────────────────────────────────── */
  const initializeGmailSync = useCallback(async () => {
    if (!user) return
    setIsAutoSyncing(true)
    setSyncStatusText('Checking for new mail...')

    try {
      // 1. Instantly load cached inbox from MongoDB so user sees emails immediately
      await fetchMailbox(currentView)

      // 2. Perform background auto sync (incremental or initial full sync)
      const { data } = await api.post('/api/emails/sync/auto')

      if (data.mode === 'full') {
        setSyncStatusText('Mailbox ready')
        await fetchMailbox(currentView)
        showNotification('Initial Gmail synchronization complete!', 'success')
      } else {
        if (data.newMessagesCount > 0) {
          setSyncStatusText(`Synced ${data.newMessagesCount} new message(s)`)
          await fetchMailbox(currentView)
          showNotification(`New emails synced (${data.newMessagesCount} new)`, 'info')
        } else {
          setSyncStatusText('✓ Mailbox up to date')
        }
      }
    } catch (err) {
      console.warn('[Auto Sync] Failed:', err.message)
      setSyncStatusText('Sync status unavailable')
    } finally {
      setIsAutoSyncing(false)
    }
  }, [user, currentView, fetchMailbox, showNotification])

  // Automatically trigger initializeGmailSync on session boot
  useEffect(() => {
    if (user && (user.id || user._id || user.email)) {
      initializeGmailSync()
    }
  }, [user?.email, user?.id])


  /* ─────────────────────────────────────────────────────────────── */
  /* Open email detail                                                */
  /* ─────────────────────────────────────────────────────────────── */
  const openEmail = useCallback(async (emailId) => {
    try {
      const { data } = await api.get(`/api/emails/${emailId}`)
      const emailObj = data.email

      if (emailObj) {
        const isDraft = Boolean(
          currentView === 'drafts' ||
          emailObj.isDraft ||
          (Array.isArray(emailObj.labels) && (emailObj.labels.includes('DRAFT') || emailObj.labels.includes('DRAFTS')))
        )

        if (isDraft) {
          setComposeData({
            id: emailObj.id,
            draftId: emailObj.id,
            to: emailObj.to || (Array.isArray(emailObj.recipients) ? emailObj.recipients.join(', ') : ''),
            subject: emailObj.subject || '',
            body: emailObj.body || emailObj.snippet || '',
          })
          setCurrentView('compose')
          return emailObj
        }

        setOpenedEmail(emailObj)
        setCurrentView('detail')
        setInboxEmails(prev => prev.map(e => e.id === emailId ? { ...e, isRead: true } : e))
        setDisplayedEmails(prev => prev.map(e => e.id === emailId ? { ...e, isRead: true } : e))
        return emailObj
      }
    } catch (err) {
      showNotification('Could not load email', 'error')
    }
  }, [currentView, showNotification])

  /* ─────────────────────────────────────────────────────────────── */
  /* Send email                                                       */
  /* ─────────────────────────────────────────────────────────────── */
  const sendEmail = useCallback(async (emailData) => {
    console.log('[SEND DEBUG] emailData:', emailData)
    setSendingEmail(true)
    try {
      const { data } = await api.post('/api/emails/send', emailData)
      showNotification('Email sent successfully via Gmail API! ✓', 'success')

      const sentMsg = data.email || {
        id: data.messageId || `sent_${Date.now()}`,
        gmailMessageId: data.messageId || `sent_${Date.now()}`,
        sender: user?.email || 'Me',
        senderEmail: user?.email || '',
        recipients: typeof emailData.to === 'string'
          ? emailData.to.split(/[,;]+/).map(s => {
            const match = s.match(/<(.+?)>/)
            return (match ? match[1] : s).trim()
          }).filter(Boolean)
          : [emailData.to],
        subject: emailData.subject,
        snippet: emailData.body?.slice(0, 100) || '',
        body: emailData.body || '',
        internalDate: Date.now(),
        receivedAt: new Date(),
        sentAt: new Date(),
        labels: ['SENT'],
        isRead: true,
      }

      const msgId = sentMsg.id || sentMsg.gmailMessageId
      setSentEmails(prev => [sentMsg, ...prev.filter(e => e.id !== msgId && e.gmailMessageId !== msgId)])
      setDisplayedEmails(prev => {
        if (currentView === 'sent') {
          return [sentMsg, ...prev.filter(e => e.id !== msgId && e.gmailMessageId !== msgId)]
        }
        return prev
      })
      setComposeData({ to: '', subject: '', body: '' })

      fetchLabels().catch(() => { })
      return { success: true, messageId: data?.messageId || data?.id, email: sentMsg }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send email'
      showNotification(msg, 'error')
      return { success: false, error: msg }
    } finally {
      setSendingEmail(false)
    }
  }, [showNotification, fetchMailbox, fetchLabels, user])


  /* ─────────────────────────────────────────────────────────────── */
  /* Search (used by AI tool)                                         */
  /* ─────────────────────────────────────────────────────────────── */
  const searchEmails = useCallback(async (query) => {
    return fetchMailbox(currentView, { query })
  }, [fetchMailbox, currentView])

  const clearSearch = useCallback(() => {
    setFilters({ unreadOnly: false, dateRange: 'all', sender: '', keyword: '' })
    if (inboxEmails && inboxEmails.length > 0) {
      setDisplayedEmails(inboxEmails)
    }
    fetchMailbox('inbox')
  }, [inboxEmails, fetchMailbox])

  /* ─────────────────────────────────────────────────────────────── */
  /* Prepend real-time email (from Socket.io mail:new)               */
  /* ─────────────────────────────────────────────────────────────── */
  const prependEmail = useCallback((email) => {
    if (!email || (!email.id && !email.gmailMessageId)) return
    const msgId = email.id || email.gmailMessageId
    setInboxEmails(prev => [email, ...prev.filter(e => e.id !== msgId && e.gmailMessageId !== msgId)])
    setDisplayedEmails(prev => {
      if (currentView === 'inbox') {
        return [email, ...prev.filter(e => e.id !== msgId && e.gmailMessageId !== msgId)]
      }
      return prev
    })
    showNotification(`📬 New email: ${email.subject || 'No subject'}`, 'info')
  }, [showNotification, currentView])

  /* ─────────────────────────────────────────────────────────────── */
  /* Handle real-time sent email (from Socket.io email:sent)         */
  /* ─────────────────────────────────────────────────────────────── */
  const handleEmailSent = useCallback((sentEmail) => {
    if (!sentEmail || (!sentEmail.id && !sentEmail.gmailMessageId)) return
    console.log('[AppContext] 📤 email:sent received:', sentEmail.subject)
    const msgId = sentEmail.id || sentEmail.gmailMessageId
    setSentEmails(prev => [sentEmail, ...prev.filter(e => e.id !== msgId && e.gmailMessageId !== msgId)])
    setDisplayedEmails(prev => {
      if (currentView === 'sent') {
        return [sentEmail, ...prev.filter(e => e.id !== msgId && e.gmailMessageId !== msgId)]
      }
      return prev
    })
    fetchLabels().catch(() => { })
  }, [currentView, fetchLabels])

  /* ─────────────────────────────────────────────────────────────── */
  /* Update real-time email (from Socket.io mail:updated)           */
  /* ─────────────────────────────────────────────────────────────── */
  const updateEmailState = useCallback((updated) => {
    if (!updated || !updated.id) return
    const updateFn = list => list.map(e => (e.id === updated.id ? { ...e, ...updated } : e))
    setInboxEmails(updateFn)
    setSentEmails(updateFn)
    setDisplayedEmails(updateFn)
    setOpenedEmail(prev => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
  }, [])

  /* ─────────────────────────────────────────────────────────────── */
  /* Remove real-time email (from Socket.io mail:deleted)           */
  /* ─────────────────────────────────────────────────────────────── */
  const removeEmailState = useCallback((emailId) => {
    if (!emailId) return
    const filterFn = list => list.filter(e => e.id !== emailId)
    setInboxEmails(filterFn)
    setSentEmails(filterFn)
    setDisplayedEmails(filterFn)
    setOpenedEmail(prev => {
      if (prev && prev.id === emailId) {
        setCurrentView('inbox')
        return null
      }
      return prev
    })
    showNotification('Email removed', 'info')
  }, [showNotification])

  /* ─────────────────────────────────────────────────────────────── */
  /* Handle Sync Completion (from Socket.io sync:complete)           */
  /* ─────────────────────────────────────────────────────────────── */
  const handleSyncComplete = useCallback((stats = {}) => {
    showNotification(`⚡ Inbox sync completed (${stats.count || 0} messages)`, 'success')
  }, [showNotification])

  /* ─────────────────────────────────────────────────────────────── */
  /* Delete Email API Action                                         */
  /* ─────────────────────────────────────────────────────────────── */
  const deleteEmail = useCallback(async (emailId) => {
    try {
      await api.delete(`/api/emails/${emailId}`)
      removeEmailState(emailId)
      return { success: true }
    } catch (err) {
      showNotification('Failed to delete email', 'error')
      return { success: false }
    }
  }, [removeEmailState, showNotification])

  /* ── Selection Helpers ────────────────────────────────────────── */
  const toggleSelectEmail = useCallback((emailId) => {
    setSelectedEmailIds(prev => {
      const next = new Set(prev)
      if (next.has(emailId)) next.delete(emailId)
      else next.add(emailId)
      return next
    })
  }, [])

  const selectAllVisible = useCallback((visibleEmails) => {
    const visibleIds = visibleEmails.map(e => e.id || e.gmailMessageId)
    setSelectedEmailIds(prev => {
      const allSelected = visibleIds.every(id => prev.has(id))
      if (allSelected) return new Set()
      return new Set(visibleIds)
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedEmailIds(new Set())
  }, [])

  /* ── Star / Unstar ────────────────────────────────────────────── */
  const toggleStar = useCallback(async (emailId, currentStarredState) => {
    const action = currentStarredState ? 'unstar' : 'star'
    const updateFn = list => list.map(e => (e.id === emailId || e.gmailMessageId === emailId ? { ...e, isStarred: !currentStarredState } : e))
    setDisplayedEmails(updateFn)
    setInboxEmails(updateFn)
    setSentEmails(updateFn)

    try {
      await api.post(`/api/emails/${emailId}/${action}`)
      showNotification(currentStarredState ? 'Removed star' : 'Starred email', 'info')
    } catch (err) {
      showNotification('Failed to update star state', 'error')
      fetchMailbox(currentView)
    }
  }, [currentView, fetchMailbox, showNotification])

  /* ── Archive Email ────────────────────────────────────────────── */
  const archiveEmail = useCallback(async (emailId) => {
    removeEmailState(emailId)
    try {
      await api.post(`/api/emails/${emailId}/archive`)
      showNotification('Email archived', 'success')
    } catch (err) {
      showNotification('Failed to archive email', 'error')
      fetchMailbox(currentView)
    }
  }, [currentView, fetchMailbox, removeEmailState, showNotification])

  /* ── Trash Email ──────────────────────────────────────────────── */
  const trashEmail = useCallback(async (emailId) => {
    removeEmailState(emailId)
    try {
      await api.delete(`/api/emails/${emailId}`)
      showNotification('Moved email to trash', 'info')
    } catch (err) {
      showNotification('Failed to move email to trash', 'error')
      fetchMailbox(currentView)
    }
  }, [currentView, fetchMailbox, removeEmailState, showNotification])

  /* ── Batch Modify ─────────────────────────────────────────────── */
  const batchModify = useCallback(async (action) => {
    const ids = Array.from(selectedEmailIds)
    if (!ids.length) return
    clearSelection()
    try {
      await api.post('/api/emails/batch-modify', { ids, action })
      showNotification(`Batch ${action} completed on ${ids.length} email(s)`, 'success')
      fetchMailbox(currentView)
    } catch (err) {
      showNotification(`Batch ${action} failed`, 'error')
    }
  }, [selectedEmailIds, clearSelection, showNotification, fetchMailbox, currentView])

  /* ── Save Draft ───────────────────────────────────────────────── */
  const saveDraft = useCallback(async (draft) => {
    try {
      const { data } = await api.post('/api/emails/draft', draft)
      showNotification('Draft saved to Gmail!', 'success')
      return { success: true, draftId: data.draftId }
    } catch (err) {
      showNotification('Failed to save draft', 'error')
      return { success: false }
    }
  }, [showNotification])

  /* ── Delete Draft ─────────────────────────────────────────────── */
  const deleteDraft = useCallback(async (draftId) => {
    if (!draftId) return
    try {
      await api.delete(`/api/emails/draft/${draftId}`)
      showNotification('Draft discarded', 'info')
    } catch (err) {
      console.warn('Draft deletion failed:', err.message)
    }
  }, [showNotification])

  /* ─────────────────────────────────────────────────────────────── */
  /* Filtered email list                                              */
  /* ─────────────────────────────────────────────────────────────── */
  const applyFilters = useCallback((emailList) => {
    let filtered = [...(emailList || [])]
    if (filters.unreadOnly) {
      filtered = filtered.filter(e => !e.isRead)
    }
    if (filters.sender) {
      const s = filters.sender.toLowerCase()
      filtered = filtered.filter(e => e.from?.toLowerCase().includes(s) || e.sender?.toLowerCase().includes(s))
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      filtered = filtered.filter(e =>
        e.subject?.toLowerCase().includes(kw) ||
        e.snippet?.toLowerCase().includes(kw) ||
        e.from?.toLowerCase().includes(kw) ||
        e.sender?.toLowerCase().includes(kw)
      )
    }
    if (filters.dateRange !== 'all') {
      const now = Date.now()
      let days = 30
      if (typeof filters.dateRange === 'number') {
        days = filters.dateRange
      } else if (filters.dateRange === 'today') {
        days = 1
      } else if (filters.dateRange === 'week' || filters.dateRange === '7') {
        days = 7
      } else if (filters.dateRange === '10days' || filters.dateRange === '10') {
        days = 10
      } else if (filters.dateRange === 'month' || filters.dateRange === '30') {
        days = 30
      }
      const cutoff = now - days * 86400000
      filtered = filtered.filter(e => {
        const t = Number(e.internalDate) || (e.receivedAt ? new Date(e.receivedAt).getTime() : (e.date ? new Date(e.date).getTime() : 0))
        return t >= cutoff
      })
    }

    return filtered.sort((a, b) => {
      const timeA = Number(a.internalDate) || (a.receivedAt ? new Date(a.receivedAt).getTime() : (a.date ? new Date(a.date).getTime() : 0))
      const timeB = Number(b.internalDate) || (b.receivedAt ? new Date(b.receivedAt).getTime() : (b.date ? new Date(b.date).getTime() : 0))
      return timeB - timeA
    })
  }, [filters])

  /* ─────────────────────────────────────────────────────────────── */
  /* Context value                                                    */
  /* ─────────────────────────────────────────────────────────────── */
  const value = {
    // Views
    currentView, setCurrentView,
    openedEmail, setOpenedEmail,
    // Emails & Labels
    inboxEmails, setInboxEmails,
    sentEmails, setSentEmails,
    displayedEmails, setDisplayedEmails,
    labels, setLabels,
    mailboxPagination, setMailboxPagination,
    // Compose
    composeData, setComposeData,
    // Loading & Sync status
    loadingInbox, loadingSent, sendingEmail, syncStatusText, isAutoSyncing,
    error, setError,
    // Filters
    filters, setFilters, applyFilters,
    // Auth
    user, setUser, authChecked,
    checkAuth, logout,
    // Selection
    selectedEmailIds, setSelectedEmailIds, toggleSelectEmail, selectAllVisible, clearSelection,
    // Actions
    fetchLabels, fetchMailbox, loadMoreMailbox,
    fetchInbox, fetchSent, syncAll, initializeGmailSync,
    openEmail, sendEmail, searchEmails, clearSearch, deleteEmail,
    toggleStar, archiveEmail, trashEmail, saveDraft, deleteDraft, batchModify,
    prependEmail, handleEmailSent, updateEmailState, removeEmailState, handleSyncComplete,

    // Notifications
    notification, showNotification,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

