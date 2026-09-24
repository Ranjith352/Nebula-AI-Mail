import React, { useEffect } from 'react'
import { RefreshCw, Send, ChevronRight, Loader2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import EmailListItem from './EmailListItem'

export default function SentView() {
  const { sentEmails, loadingInbox, fetchMailbox, loadMoreMailbox, mailboxPagination, openEmail, applyFilters } = useApp()
  const displaySentEmails = applyFilters(sentEmails)

  useEffect(() => {
    fetchMailbox('sent')
  }, [fetchMailbox])

  return (
    <div className="flex flex-col h-full view-enter bg-[#0e1219] text-[#e6edf3]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[#262c36] bg-[#11161d] flex-shrink-0 flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5">
          <Send size={18} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Sent</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#181f2a] text-[#8b949e] border border-[#262c36] font-mono">
            {displaySentEmails.length} sent
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#8b949e]">
          <span className="font-mono">
            {displaySentEmails.length > 0
              ? `1-${displaySentEmails.length}${mailboxPagination.resultSizeEstimate ? ` of ${mailboxPagination.resultSizeEstimate.toLocaleString()}` : ''}`
              : '0 of 0'}
          </span>
          <button
            id="sent-refresh-btn"
            onClick={() => fetchMailbox('sent')}
            disabled={loadingInbox}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#1c232d] transition-colors"
            title="Refresh sent emails"
          >
            <RefreshCw size={15} className={loadingInbox ? 'animate-spin text-indigo-400' : ''} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loadingInbox && displaySentEmails.length === 0 ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 items-center p-3 bg-[#11161d] rounded-xl border border-[#262c36]">
                <div className="skeleton w-4 h-4 rounded" />
                <div className="skeleton w-7 h-7 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-1/4 rounded" />
                  <div className="skeleton h-3 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displaySentEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#8b949e] space-y-2">
            <Send size={24} className="opacity-40" />
            <p className="text-sm font-semibold text-white">No sent emails found</p>
          </div>
        ) : (
          <>
            {displaySentEmails.map(email => (
              <EmailListItem
                key={email.id}
                email={{ ...email, isRead: true }}
                onClick={() => openEmail(email.id)}
              />
            ))}

            {mailboxPagination.hasMore && (
              <div className="p-4 flex justify-center bg-[#0e1219]">
                <button
                  id="sent-load-more-btn"
                  onClick={loadMoreMailbox}
                  disabled={mailboxPagination.loadingMore}
                  className="px-6 py-2.5 rounded-xl bg-[#181f2a] hover:bg-[#202734] border border-[#262c36] text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-2 transition-all shadow-md"
                >
                  {mailboxPagination.loadingMore ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Loading more sent messages...</span>
                    </>
                  ) : (
                    <>
                      <span>Load More Sent Messages</span>
                      <ChevronRight size={14} />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {!loadingInbox && sentEmails.length > 0 && (
        <div className="px-4 py-2 border-t border-[#262c36] bg-[#11161d] flex-shrink-0 flex items-center justify-between text-xs text-[#8b949e]">
          <span>{sentEmails.length} sent conversation{sentEmails.length !== 1 ? 's' : ''} loaded</span>
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Gmail API Live Sync Active
          </span>
        </div>
      )}
    </div>
  )
}
