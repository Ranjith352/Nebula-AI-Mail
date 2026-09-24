import React, { useState, useEffect } from 'react'
import {
  RefreshCw, Filter, Search, X, CheckSquare,
  Square, Star, Sparkles, Inbox as InboxIcon, Send,
  MoreVertical, Archive, Trash2, Mail, MailOpen, ChevronLeft, ChevronRight,
  Clock, FileText, AlertOctagon, Tag, Loader2
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import EmailListItem from './EmailListItem'
import FilterPanel from '../filters/FilterPanel'

export default function InboxView() {
  const {
    displayedEmails, loadingInbox,
    fetchMailbox, loadMoreMailbox, mailboxPagination, labels,
    openEmail, applyFilters, selectedEmailIds, selectAllVisible, batchModify,
    searchEmails, clearSearch, filters, currentView, setCurrentView
  } = useApp()

  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState('primary') // 'primary' | 'starred' | 'ai'

  const hasActiveSearchFilter = Boolean(filters?.sender || filters?.keyword)

  // Auto-fetch current view when view changes
  useEffect(() => {
    if (currentView !== 'compose' && currentView !== 'detail') {
      fetchMailbox(currentView)
    }
  }, [currentView, fetchMailbox])

  const filteredEmails = applyFilters(displayedEmails)

  // Filter emails dynamically based on currentView or activeTab
  const getDisplayEmails = () => {
    const isStarredEmail = (e) =>
      Boolean(e.isStarred) ||
      (Array.isArray(e.labels) && (e.labels.includes('STARRED') || e.labels.includes('starred')))

    const isSnoozedEmail = (e) =>
      Boolean(e.isSnoozed) ||
      (Array.isArray(e.labels) && (e.labels.includes('SNOOZED') || e.labels.includes('snoozed') || e.labels.includes('MUTED')))

    const isDraftEmail = (e) =>
      Boolean(e.isDraft) ||
      (Array.isArray(e.labels) && (e.labels.includes('DRAFT') || e.labels.includes('DRAFTS') || e.labels.includes('draft')))

    const isComplaintEmail = (e) =>
      Boolean(e.isSpam || e.isComplaint) ||
      (Array.isArray(e.labels) && (e.labels.includes('SPAM') || e.labels.includes('COMPLAINTS') || e.labels.includes('TRASH')))

    if (currentView === 'starred' || activeTab === 'starred') {
      return filteredEmails.filter(isStarredEmail)
    }
    if (currentView === 'snoozed') {
      return filteredEmails.filter(isSnoozedEmail)
    }
    if (currentView === 'drafts') {
      return filteredEmails.filter(isDraftEmail)
    }
    if (currentView === 'complaints') {
      return filteredEmails.filter(isComplaintEmail)
    }
    if (currentView === 'ai' || activeTab === 'ai') {
      return filteredEmails.filter(e => e.isAiGenerated || e.aiSummary || (e.snippet && e.snippet.length > 30))
    }
    return filteredEmails
  }

  const emailsToDisplay = getDisplayEmails()
  const isAllSelected = emailsToDisplay.length > 0 && emailsToDisplay.every(e => selectedEmailIds.has(e.id || e.gmailMessageId))
  const selectedCount = selectedEmailIds.size

  // View titles & icons
  const viewTitle = (() => {
    if (currentView.startsWith('label:')) {
      const labelId = currentView.replace('label:', '')
      const match = labels.find(l => l.id === labelId)
      return { name: match?.name || labelId, icon: Tag, color: 'text-indigo-400' }
    }
    switch (currentView) {
      case 'starred':    return { name: 'Starred', icon: Star, color: 'text-amber-400' }
      case 'snoozed':    return { name: 'Snoozed', icon: Clock, color: 'text-[#38bdf8]' }
      case 'sent':       return { name: 'Sent', icon: Send, color: 'text-emerald-400' }
      case 'drafts':     return { name: 'Drafts', icon: FileText, color: 'text-purple-400' }
      case 'complaints': return { name: 'Spam & Complaints', icon: AlertOctagon, color: 'text-rose-400' }
      case 'ai':         return { name: 'AI Insights & Summaries', icon: Sparkles, color: 'text-cyan-400' }
      default:           return { name: 'Inbox', icon: InboxIcon, color: 'text-indigo-400' }
    }
  })()
  const TitleIcon = viewTitle.icon


  return (
    <div className="flex flex-col h-full view-enter bg-[#0e1219] text-[#e6edf3]">
      {/* ── 1. Gmail Top Action Toolbar ─────────────────────────── */}
      <div className="px-4 py-2.5 border-b border-[#262c36] bg-[#11161d] flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          {/* Checkbox select all */}
          <button
            onClick={() => selectAllVisible(emailsToDisplay)}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#1c232d] transition-colors"
            title={isAllSelected ? "Deselect all" : "Select all visible"}
          >
            {isAllSelected ? <CheckSquare size={16} className="text-indigo-400" /> : <Square size={16} />}
          </button>

          <div className="h-4 w-[1px] bg-[#262c36] mx-1" />

          {/* Refresh button */}
          <button
            id="refresh-btn"
            onClick={() => fetchMailbox(currentView)}
            disabled={loadingInbox}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#1c232d] transition-colors"
            title="Refresh inbox"
          >
            <RefreshCw size={15} className={loadingInbox ? 'animate-spin text-indigo-400' : ''} />
          </button>

          {/* Filter Panel Toggle */}
          <button
            id="filter-toggle-btn"
            onClick={() => setShowFilters(v => !v)}
            className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 font-medium ${
              showFilters ? 'bg-indigo-600/20 text-indigo-400' : 'text-[#8b949e] hover:text-white hover:bg-[#1c232d]'
            }`}
            title="Filter panel"
          >
            <Filter size={15} />
            <span className="hidden sm:inline">Filters</span>
          </button>

          {/* Batch Toolbar Action Buttons */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-1 ml-2 animate-in fade-in">
              <span className="text-xs text-indigo-400 font-semibold px-2">
                {selectedCount} selected
              </span>

              <button
                onClick={() => batchModify('archive')}
                className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#1c232d] transition-colors"
                title="Archive selected"
              >
                <Archive size={15} />
              </button>

              <button
                onClick={() => batchModify('read')}
                className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#1c232d] transition-colors"
                title="Mark selected as read"
              >
                <MailOpen size={15} />
              </button>

              <button
                onClick={() => batchModify('unread')}
                className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#1c232d] transition-colors"
                title="Mark selected as unread"
              >
                <Mail size={15} />
              </button>

              <button
                onClick={() => batchModify('trash')}
                className="p-1.5 rounded-lg text-[#8b949e] hover:text-rose-400 hover:bg-[#1c232d] transition-colors"
                title="Move selected to trash"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Right side: Pagination Stats */}
        <div className="flex items-center gap-3 text-xs text-[#8b949e]">
          <span className="font-mono">
            {emailsToDisplay.length > 0
              ? `1-${emailsToDisplay.length}${mailboxPagination.resultSizeEstimate ? ` of ${mailboxPagination.resultSizeEstimate.toLocaleString()}` : ''}`
              : '0 of 0'}
          </span>
          <div className="flex items-center gap-1">
            <button disabled className="p-1 rounded text-[#8b949e] opacity-40 cursor-not-allowed">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={loadMoreMailbox}
              disabled={!mailboxPagination.hasMore || mailboxPagination.loadingMore}
              className={`p-1 rounded transition-colors ${
                mailboxPagination.hasMore ? 'text-indigo-400 hover:bg-[#1c232d]' : 'text-[#8b949e] opacity-40 cursor-not-allowed'
              }`}
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Filter Panel Toggle ──────────────────────────────── */}
      {showFilters && <FilterPanel />}

      {/* Active AI Search Filter Banner */}
      {hasActiveSearchFilter && (
        <div className="px-5 py-2.5 border-b border-indigo-500/30 bg-indigo-500/10 flex items-center justify-between flex-shrink-0 text-xs text-indigo-300 animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <Search size={14} className="text-indigo-400" />
            <span>
              Active Filter: {filters.sender ? `From "${filters.sender}"` : ''} {filters.keyword ? `Keyword "${filters.keyword}"` : ''} ({emailsToDisplay.length} email{emailsToDisplay.length !== 1 ? 's' : ''} found)
            </span>
          </div>
          <button
            onClick={clearSearch}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 transition-colors flex items-center gap-1"
          >
            <X size={13} />
            <span>Clear Search</span>
          </button>
        </div>
      )}

      {/* ── 3. View Header Banner / Category Tabs ────────────────── */}
      {currentView !== 'inbox' ? (
        <div className="px-5 py-3 border-b border-[#262c36] bg-[#11161d] flex items-center justify-between flex-shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <TitleIcon size={18} className={viewTitle.color} />
            <h2 className="text-sm font-bold text-white">{viewTitle.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#181f2a] text-[#8b949e] border border-[#262c36] font-mono">
              {emailsToDisplay.length} email{emailsToDisplay.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={() => setCurrentView('inbox')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            ← Back to Inbox
          </button>
        </div>
      ) : (
        <div className="flex items-center border-b border-[#262c36] bg-[#11161d] px-2 flex-shrink-0 select-none overflow-x-auto">
          <button
            onClick={() => setActiveTab('primary')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'primary'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-[#8b949e] hover:text-white hover:bg-[#181f2a]'
            }`}
          >
            <InboxIcon size={16} />
            <span>Primary</span>
            {filteredEmails.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
                {filteredEmails.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('starred')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'starred'
                ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                : 'border-transparent text-[#8b949e] hover:text-white hover:bg-[#181f2a]'
            }`}
          >
            <Star size={16} />
            <span>Starred</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'ai'
                ? 'border-purple-400 text-purple-400 bg-purple-400/5'
                : 'border-transparent text-[#8b949e] hover:text-white hover:bg-[#181f2a]'
            }`}
          >
            <Sparkles size={16} />
            <span>AI Insights &amp; Digest</span>
          </button>
        </div>
      )}


      {/* ── 4. Main Email List ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loadingInbox ? (
          /* Skeleton loader */
          <div className="p-4 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex gap-4 items-center p-3 bg-[#11161d] rounded-xl border border-[#262c36]">
                <div className="skeleton w-4 h-4 rounded" />
                <div className="skeleton w-4 h-4 rounded-full" />
                <div className="skeleton w-7 h-7 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-1/4 rounded" />
                  <div className="skeleton h-3 w-3/4 rounded" />
                </div>
                <div className="skeleton h-3 w-12 rounded" />
              </div>
            ))}
          </div>
        ) : emailsToDisplay.length === 0 ? (() => {
          const emptyState = (() => {
            if (hasActiveSearchFilter) return { title: 'No emails match your search.', subtitle: 'Try clearing your search query or filters.' }
            switch (currentView) {
              case 'starred':    return { title: 'No starred emails.', subtitle: 'Star important messages to find them easily here.' }
              case 'sent':       return { title: 'No sent emails.', subtitle: 'Emails you send will appear here.' }
              case 'drafts':     return { title: 'No drafts.', subtitle: 'Saved drafts will appear here.' }
              case 'important':  return { title: 'No important emails.', subtitle: 'Messages marked as important will appear here.' }
              case 'spam':
              case 'complaints': return { title: 'No spam messages.', subtitle: 'Your spam folder is clean.' }
              case 'trash':      return { title: 'No messages in Trash.', subtitle: 'Deleted emails will appear here.' }
              default:           return { title: 'No emails in your inbox.', subtitle: 'Your inbox is up to date.' }
            }
          })()

          return (
            <div className="flex flex-col items-center justify-center h-64 text-[#8b949e] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#181f2a] border border-[#262c36] flex items-center justify-center text-[#8b949e]">
                <Search size={22} className="opacity-40" />
              </div>
              <p className="text-sm font-semibold text-white">{emptyState.title}</p>
              <p className="text-xs text-[#8b949e]">{emptyState.subtitle}</p>
            </div>
          )
        })() : (
          <>
            {emailsToDisplay.map(email => (
              <EmailListItem
                key={email.id}
                email={email}
                onClick={() => openEmail(email.id)}
              />
            ))}

            {/* Load More Button for Pagination */}
            {mailboxPagination.hasMore && (
              <div className="p-4 flex justify-center bg-[#0e1219]">
                <button
                  id="load-more-btn"
                  onClick={loadMoreMailbox}
                  disabled={mailboxPagination.loadingMore}
                  className="px-6 py-2.5 rounded-xl bg-[#181f2a] hover:bg-[#202734] border border-[#262c36] text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-2 transition-all shadow-md"
                >
                  {mailboxPagination.loadingMore ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Loading more messages...</span>
                    </>
                  ) : (
                    <>
                      <span>Load More Messages</span>
                      <ChevronRight size={14} />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 5. Footer Status Bar ─────────────────────────────────── */}
      {!loadingInbox && emailsToDisplay.length > 0 && (
        <div className="px-4 py-2 border-t border-[#262c36] bg-[#11161d] flex-shrink-0 flex items-center justify-between text-xs text-[#8b949e]">
          <span>
            {emailsToDisplay.length} conversation{emailsToDisplay.length !== 1 ? 's' : ''} loaded
          </span>
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Nebula AI Mail Sync Engine Active
          </span>
        </div>
      )}
    </div>
  )
}

