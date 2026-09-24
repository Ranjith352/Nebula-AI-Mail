import React, { useState } from 'react'
import { Send, X, Loader2, CornerUpLeft } from 'lucide-react'
import { useApp } from '../../context/AppContext'

/**
 * Dedicated Reply View component for context-aware email replies.
 * Uses the normalized ApplicationEmail fields: sender, senderEmail, receivedAt.
 */
export default function ReplyView() {
  const { openedEmail, sendEmail, setCurrentView, showNotification } = useApp()
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)

  if (!openedEmail) {
    return (
      <div className="p-6 text-center text-[#8b949e]">
        No email selected for reply.
      </div>
    )
  }

  // Use normalized fields: senderEmail (bare address), sender (display)
  const recipient    = openedEmail.senderEmail || openedEmail.sender || openedEmail.from || ''
  const displayName  = openedEmail.sender      || openedEmail.from   || recipient
  const receivedDate = openedEmail.receivedAt  || openedEmail.date
  const subject = (openedEmail.subject || '').startsWith('Re:')
    ? openedEmail.subject
    : `Re: ${openedEmail.subject || '(no subject)'}`

  const handleSendReply = async (e) => {
    e.preventDefault()
    if (!replyBody.trim()) {
      showNotification('Reply message cannot be empty', 'error')
      return
    }

    setSending(true)
    const dateStr = receivedDate ? new Date(receivedDate).toDateString() : ''
    const fullBody = `${replyBody.trim()}\n\n---\nOn ${dateStr}, ${displayName} wrote:\n${openedEmail.snippet || ''}`

    const result = await sendEmail({ to: recipient, subject, body: fullBody })
    setSending(false)

    if (result?.success) {
      setCurrentView('inbox')
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#e6edf3]">
      <div className="px-6 py-4 border-b border-[#30363d] bg-[#161b22] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CornerUpLeft size={18} className="text-indigo-400" />
          <h2 className="text-base font-semibold">Reply to {displayName}</h2>
        </div>
        <button
          onClick={() => setCurrentView('detail')}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSendReply} className="flex-1 p-6 flex flex-col space-y-4">
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-3">
          <div className="text-xs text-[#8b949e]">
            <span className="font-semibold text-[#e6edf3]">To:</span> {recipient}
          </div>
          <div className="text-xs text-[#8b949e]">
            <span className="font-semibold text-[#e6edf3]">Subject:</span> {subject}
          </div>
        </div>

        <textarea
          value={replyBody}
          onChange={e => setReplyBody(e.target.value)}
          placeholder="Write your reply here..."
          rows={10}
          className="flex-1 w-full bg-[#161b22] border border-[#30363d] rounded-xl p-4 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={sending || !replyBody.trim()}
            className="btn-gradient text-white text-sm font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            <span>Send Reply</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('detail')}
            className="text-[#8b949e] hover:text-[#e6edf3] text-sm px-4 py-2.5 rounded-xl hover:bg-[#21262d]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
