import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Reply, Forward, Clock, Send, MessageSquare, Loader2, CheckCircle2, User as UserIcon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import api from '../../services/api'

/**
 * EmailDetail — Thread View Component
 * Group emails by Gmail threadId, display full conversation history chronologically,
 * and allow inline replying within the thread.
 */
export default function EmailDetail() {
  const {
    openedEmail,
    setCurrentView,
    setComposeData,
    inboxEmails,
    sentEmails,
    displayedEmails,
    showNotification,
    toggleStar,
    archiveEmail,
    trashEmail,
    user,
  } = useApp()

  const isStarred = Boolean(openedEmail?.isStarred || (Array.isArray(openedEmail?.labels) && openedEmail.labels.includes('STARRED')))
  const emailId = openedEmail?.id || openedEmail?.gmailMessageId

  const handleStarClick = () => {
    if (emailId) toggleStar(emailId, isStarred)
  }

  const handleArchiveClick = () => {
    if (emailId) {
      archiveEmail(emailId)
      setCurrentView('inbox')
    }
  }

  const handleTrashClick = () => {
    if (emailId) {
      trashEmail(emailId)
      setCurrentView('inbox')
    }
  }

  const [threadList, setThreadList] = useState([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [showReplyBox, setShowReplyBox] = useState(false)

  // Combine local state emails sharing the same threadId
  const localThreadMessages = useMemo(() => {
    if (!openedEmail) return []
    const tid = openedEmail.threadId
    const all = [...(inboxEmails || []), ...(sentEmails || []), ...(displayedEmails || [])]

    const matched = tid ? all.filter(e => e.threadId === tid) : [openedEmail]
    const map = new Map()
    matched.forEach(m => map.set(m.id, m))
    if (openedEmail.id && !map.has(openedEmail.id)) {
      map.set(openedEmail.id, openedEmail)
    }

    return Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.receivedAt || a.date || 0).getTime()
      const timeB = new Date(b.receivedAt || b.date || 0).getTime()
      return timeA - timeB
    })
  }, [openedEmail, inboxEmails, sentEmails, displayedEmails])

  // Initialize thread messages & try fetching full thread from API
  useEffect(() => {
    if (!openedEmail) return
    setThreadList(localThreadMessages)

    if (openedEmail.threadId) {
      let isMounted = true
      setLoadingThread(true)
      api.get(`/api/emails/thread/${openedEmail.threadId}`)
        .then(({ data }) => {
          if (isMounted && data?.emails?.length > 0) {
            const map = new Map()
            localThreadMessages.forEach(m => map.set(m.id, m))
            data.emails.forEach(m => map.set(m.id, m))

            const sorted = Array.from(map.values()).sort((a, b) => {
              const timeA = new Date(a.receivedAt || a.date || 0).getTime()
              const timeB = new Date(b.receivedAt || b.date || 0).getTime()
              return timeA - timeB
            })
            setThreadList(sorted)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingThread(false)
        })

      return () => { isMounted = false }
    }
  }, [openedEmail, localThreadMessages])

  if (!openedEmail) {
    setCurrentView('inbox')
    return null
  }

  // Compose redirect helpers
  const handleComposeReply = (emailToReply) => {
    const target = emailToReply || openedEmail
    const rawFrom = target.senderEmail || target.sender || target.from || ''
    const match = rawFrom.match(/<(.+?)>/)
    const senderEmail = match ? match[1].trim() : (rawFrom || '').trim()

    setComposeData({
      to: senderEmail,
      subject: target.subject?.startsWith('Re:') ? target.subject : `Re: ${target.subject || '(no subject)'}`,
      body: `\n\n---\nOn ${new Date(target.receivedAt || target.date).toLocaleString()}, ${senderEmail} wrote:\n${target.snippet || target.body || ''}`,
    })
    setCurrentView('compose')
  }

  const handleForward = (emailToForward) => {
    const target = emailToForward || openedEmail
    setComposeData({
      to: '',
      subject: `Fwd: ${target.subject || '(no subject)'}`,
      body: `\n\n---------- Forwarded message ---------\nFrom: ${target.sender || target.from}\nDate: ${new Date(target.receivedAt || target.date).toLocaleString()}\nSubject: ${target.subject}\n\n${target.body || target.snippet || ''}`,
    })
    setCurrentView('compose')
  }

  // Inline Thread Reply Submission
  const handleSendThreadReply = async () => {
    if (!replyText.trim() || sendingReply) return

    setSendingReply(true)
    try {
      const lastMsg = threadList[threadList.length - 1] || openedEmail
      const res = await api.post(`/api/emails/${lastMsg.id}/reply`, { body: replyText.trim() })

      if (res.data?.success) {
        showNotification('Reply sent in conversation thread! ✓', 'success')

        // Append new reply message to local thread view in real time
        const newReplyMsg = {
          id: res.data.messageId || `reply_${Date.now()}`,
          threadId: openedEmail.threadId,
          sender: user?.email || 'Me',
          senderEmail: user?.email || 'Me',
          recipients: [openedEmail.senderEmail || openedEmail.from],
          subject: openedEmail.subject?.startsWith('Re:') ? openedEmail.subject : `Re: ${openedEmail.subject}`,
          snippet: replyText.trim().slice(0, 100),
          body: replyText.trim(),
          receivedAt: new Date().toISOString(),
          isRead: true,
        }

        setThreadList(prev => [...prev, newReplyMsg])
        setReplyText('')
        setShowReplyBox(false)
      }
    } catch (err) {
      showNotification('Failed to send thread reply', 'error')
    } finally {
      setSendingReply(false)
    }
  }

  return (
    <div className="flex flex-col h-full view-enter bg-[#0d1117] text-[#e6edf3]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#30363d] bg-[#161b22] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            id="email-back-btn"
            onClick={() => setCurrentView('inbox')}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors flex-shrink-0"
            title="Back to inbox"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#e6edf3] truncate">
              {openedEmail.subject || '(no subject)'}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-[#8b949e]">
              <MessageSquare size={11} className="text-indigo-400" />
              <span>Thread ({threadList.length} message{threadList.length !== 1 ? 's' : ''})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="reply-btn"
            onClick={() => handleComposeReply(openedEmail)}
            title="Reply in compose"
            className="p-2 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          >
            <Reply size={15} />
          </button>
          <button
            id="forward-btn"
            onClick={() => handleForward(openedEmail)}
            title="Forward"
            className="p-2 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          >
            <Forward size={15} />
          </button>
        </div>
      </div>

      {/* Main Conversation History Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Thread Header Banner */}
          <div className="flex items-center justify-between pb-3 border-b border-[#30363d]">
            <h1 className="text-xl font-semibold text-[#e6edf3] leading-snug">
              {openedEmail.subject || '(no subject)'}
            </h1>
            {loadingThread && (
              <div className="flex items-center gap-1.5 text-xs text-[#8b949e]">
                <Loader2 size={12} className="animate-spin text-indigo-400" />
                <span>Loading thread...</span>
              </div>
            )}
          </div>

          {/* AI Key Insights Banner */}
          <div className="bg-[#161b22] border border-indigo-500/30 rounded-2xl p-4 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                <Sparkles size={15} className="text-indigo-400 animate-pulse" />
                <span>AI Key Insights &amp; Summary</span>
              </div>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                ⚡ Nebula AI Summary
              </span>
            </div>
            <p className="text-xs text-[#e6edf3] leading-relaxed">
              {openedEmail.snippet || openedEmail.body?.slice(0, 180) || 'Thread summary extracted.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-[#0d1117] text-[#8b949e] border border-[#30363d]">
                📌 Priority: Normal
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-[#0d1117] text-[#8b949e] border border-[#30363d]">
                📩 Sender: {openedEmail.senderEmail || openedEmail.from || 'Direct'}
              </span>
            </div>
          </div>

          {/* Chronological Messages Stream */}
          {threadList.map((msg, index) => {
            const senderRaw = msg.sender || msg.from || 'Unknown'
            const senderName = senderRaw.replace(/<.*>/, '').trim() || senderRaw
            const recipientTo = Array.isArray(msg.recipients) ? msg.recipients.join(', ') : (msg.to || '')
            const msgDate = msg.receivedAt || msg.date
            const dateFormatted = msgDate
              ? new Date(msgDate).toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: 'numeric', minute: '2-digit'
                })
              : ''
            const isLatest = index === threadList.length - 1

            return (
              <div
                key={msg.id || index}
                className={`bg-[#161b22] border rounded-2xl p-5 shadow-xl transition-all ${
                  isLatest ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-[#30363d]'
                }`}
              >
                {/* Sender Header */}
                <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-[#30363d]/60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                      <span className="text-white text-xs font-bold">
                        {(senderName[0] || 'U').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#e6edf3] text-sm font-semibold">{senderName}</span>
                        <span className="text-[10px] text-[#8b949e] font-mono">#{index + 1}</span>
                      </div>
                      {recipientTo && (
                        <p className="text-[#8b949e] text-xs">To: {recipientTo}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {dateFormatted && (
                      <div className="flex items-center gap-1 text-[#8b949e] text-xs font-mono">
                        <Clock size={11} />
                        <span>{dateFormatted}</span>
                      </div>
                    )}
                    <button
                      onClick={() => handleComposeReply(msg)}
                      className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
                      title="Reply to message"
                    >
                      <Reply size={13} />
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                {msg.bodyHtml ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none text-[#e6edf3] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                  />
                ) : (
                  <div className="text-sm text-[#e6edf3] leading-relaxed whitespace-pre-wrap font-sans">
                    {msg.body || msg.snippet || 'No message content.'}
                  </div>
                )}
              </div>
            )
          })}

          {/* Inline Thread Reply Box */}
          {showReplyBox ? (
            <div className="bg-[#161b22] border border-indigo-500/40 rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between border-b border-[#30363d] pb-2">
                <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                  <Reply size={14} />
                  Reply within Conversation Thread
                </span>
                <button
                  onClick={() => setShowReplyBox(false)}
                  className="text-[#8b949e] hover:text-[#e6edf3] text-xs"
                >
                  Close
                </button>
              </div>

              {/* AI Quick Reply Chips */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} className="text-indigo-400" />
                  <span>AI Smart Quick Replies:</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setReplyText("Received, thanks! I'll review and get back to you shortly.")}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0d1117] hover:bg-indigo-600/20 text-[#e6edf3] hover:text-indigo-300 border border-[#30363d] hover:border-indigo-500/40 transition-all"
                  >
                    ⚡ Acknowledge &amp; Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyText("Sounds good, I confirm I will join at 3 PM.")}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0d1117] hover:bg-indigo-600/20 text-[#e6edf3] hover:text-indigo-300 border border-[#30363d] hover:border-indigo-500/40 transition-all"
                  >
                    📅 Accept &amp; Join at 3 PM
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyText("Thanks for the update, looks great to me!")}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0d1117] hover:bg-indigo-600/20 text-[#e6edf3] hover:text-indigo-300 border border-[#30363d] hover:border-indigo-500/40 transition-all"
                  >
                    👍 Approved &amp; Thanks
                  </button>
                </div>
              </div>

              <textarea
                id="thread-inline-reply-input"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply to this conversation..."
                rows={4}
                disabled={sendingReply}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl p-3 text-xs text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowReplyBox(false)}
                  disabled={sendingReply}
                  className="px-3.5 py-1.5 rounded-xl bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="send-thread-reply-btn"
                  onClick={handleSendThreadReply}
                  disabled={!replyText.trim() || sendingReply}
                  className="btn-gradient text-white text-xs font-semibold px-4 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {sendingReply ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Sending Reply...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Send Reply in Thread</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              {/* Quick reply trigger chips */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setReplyText("Received, thanks! I'll review and get back to you shortly."); setShowReplyBox(true); }}
                  className="text-xs px-3 py-1.5 rounded-xl bg-[#161b22] hover:bg-indigo-600/20 text-[#e6edf3] hover:text-indigo-300 border border-[#30363d] hover:border-indigo-500/40 transition-all flex items-center gap-1.5"
                >
                  <span>⚡ Acknowledge &amp; Confirm</span>
                </button>
                <button
                  onClick={() => { setReplyText("Sounds good, I confirm I will join at 3 PM."); setShowReplyBox(true); }}
                  className="text-xs px-3 py-1.5 rounded-xl bg-[#161b22] hover:bg-indigo-600/20 text-[#e6edf3] hover:text-indigo-300 border border-[#30363d] hover:border-indigo-500/40 transition-all flex items-center gap-1.5"
                >
                  <span>📅 Accept &amp; Join at 3 PM</span>
                </button>
                <button
                  onClick={() => { setReplyText("Thanks for the update, looks great to me!"); setShowReplyBox(true); }}
                  className="text-xs px-3 py-1.5 rounded-xl bg-[#161b22] hover:bg-indigo-600/20 text-[#e6edf3] hover:text-indigo-300 border border-[#30363d] hover:border-indigo-500/40 transition-all flex items-center gap-1.5"
                >
                  <span>👍 Approved &amp; Thanks</span>
                </button>
              </div>

              <button
                id="open-thread-reply-btn"
                onClick={() => setShowReplyBox(true)}
                className="flex items-center gap-2 text-xs font-semibold text-[#8b949e] hover:text-indigo-400 transition-colors border border-[#30363d] hover:border-indigo-500/40 px-4 py-2.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] w-fit"
              >
                <Reply size={14} />
                <span>Reply in this Thread</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

