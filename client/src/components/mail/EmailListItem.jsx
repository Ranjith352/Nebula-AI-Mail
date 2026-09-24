import React, { useState } from 'react'
import { Star, Mail, MailOpen, Trash2, Archive, Clock } from 'lucide-react'
import { useApp } from '../../context/AppContext'

/**
 * EmailListItem — Gmail Style Row Component
 * Features selection checkbox, star toggle, sender avatar, bold unread typography, snippet preview,
 * timestamp formatting, and hover quick actions bar.
 */
export default function EmailListItem({ email, onClick }) {
  const { openedEmail, selectedEmailIds, toggleSelectEmail, toggleStar: contextToggleStar, archiveEmail, trashEmail, showNotification } = useApp()

  const emailId = email.id || email.gmailMessageId
  const isStarred = Boolean(email.isStarred || (Array.isArray(email.labels) && email.labels.includes('STARRED')))
  const isSelected = selectedEmailIds.has(emailId)
  const isReadState = Boolean(email.isRead)

  const isActive = openedEmail?.id === emailId

  const rawDate  = email.receivedAt || email.date || email.internalDate
  const rawFrom  = email.sender     || email.from || ''

  const formattedDate = (() => {
    if (!rawDate) return ''
    const d = new Date(Number(rawDate) || rawDate)
    if (isNaN(d.getTime()) || d.getTime() === 0) return ''

    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }

    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  })()

  // Format sender display name
  let senderName = rawFrom.replace(/<.*>/, '').trim() || rawFrom || ''
  if (!senderName || senderName === 'Unknown') {
    if (email.recipients && email.recipients.length > 0) {
      senderName = `To: ${email.recipients[0]}`
    } else {
      senderName = 'Me'
    }
  }

  const handleStarClick = (e) => {
    e.stopPropagation()
    contextToggleStar(emailId, isStarred)
  }

  const handleCheckboxClick = (e) => {
    e.stopPropagation()
    toggleSelectEmail(emailId)
  }

  const handleArchiveClick = (e) => {
    e.stopPropagation()
    archiveEmail(emailId)
  }

  const handleTrashClick = (e) => {
    e.stopPropagation()
    trashEmail(emailId)
  }

  return (
    <div
      id={`email-item-${emailId}`}
      onClick={onClick}
      className={`group relative flex items-center gap-3.5 px-4 py-3 border-b border-[#262c36]/70 transition-all cursor-pointer select-none ${
        isActive
          ? 'bg-indigo-600/15 border-l-4 border-l-indigo-500 font-medium'
          : !isReadState
          ? 'bg-[#151c27] text-white hover:bg-[#1c2432]'
          : 'bg-[#11161d] text-[#9ca3af] hover:bg-[#181f2a]'
      } ${isSelected ? 'bg-indigo-950/40' : ''}`}
    >
      {/* ── 1. Checkbox & Star ──────────────────────────────────── */}
      <div className="flex items-center gap-2.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxClick}
          className="w-4 h-4 rounded bg-[#181f2a] border-[#262c36] text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
        />

        <button
          onClick={handleStarClick}
          className={`p-1 rounded-full transition-colors hover:bg-[#262c36] ${
            isStarred ? 'text-amber-400' : 'text-[#8b949e] hover:text-amber-400'
          }`}
          title={isStarred ? 'Starred' : 'Not starred'}
        >
          <Star size={16} className={isStarred ? 'fill-amber-400 text-amber-400' : ''} />
        </button>
      </div>

      {/* ── 2. Sender Avatar & Name ──────────────────────────────── */}
      <div className="w-[180px] sm:w-[200px] flex items-center gap-2.5 flex-shrink-0 min-w-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm ${
          !isReadState
            ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white'
            : 'bg-[#262c36] text-[#8b949e]'
        }`}>
          {(senderName[0] || 'U').toUpperCase()}
        </div>

        <span className={`text-sm truncate ${
          !isReadState ? 'font-bold text-white' : 'font-medium text-[#c9d1d9]'
        }`}>
          {senderName}
        </span>
      </div>

      {/* ── 3. Subject & Snippet Preview ───────────────────────── */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={`text-sm truncate ${
          !isReadState ? 'font-semibold text-white' : 'font-normal text-[#c9d1d9]'
        }`}>
          {email.subject || '(no subject)'}
        </span>

        <span className="text-xs text-[#8b949e] truncate hidden md:inline">
          — {email.snippet || email.body?.slice(0, 80) || ''}
        </span>
      </div>

      {/* ── 4. Timestamp ────────────────────────────────────────── */}
      <div className="flex-shrink-0 text-right group-hover:hidden">
        <span className={`text-xs font-mono ${
          !isReadState ? 'font-semibold text-indigo-400' : 'text-[#8b949e]'
        }`}>
          {formattedDate}
        </span>
      </div>

      {/* ── 5. Hover Quick Action Toolbar (Gmail Style) ─────────── */}
      <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0 bg-[#181f2a] px-2 py-1 rounded-xl border border-[#262c36] shadow-md">
        <button
          onClick={handleArchiveClick}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#262c36] transition-colors"
          title="Archive email"
        >
          <Archive size={14} />
        </button>

        <button
          onClick={handleTrashClick}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-rose-400 hover:bg-[#262c36] transition-colors"
          title="Move to trash"
        >
          <Trash2 size={14} />
        </button>

        <button
          onClick={handleStarClick}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-amber-400 hover:bg-[#262c36] transition-colors"
          title="Star email"
        >
          <Star size={14} className={isStarred ? 'fill-amber-400 text-amber-400' : ''} />
        </button>
      </div>
    </div>
  )
}

