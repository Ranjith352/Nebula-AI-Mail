import React, { useState, useEffect } from 'react'
import { Search, PenSquare, Inbox, Send, Sparkles, Filter, X, ArrowRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'

/**
 * CommandPalette — Ctrl+K / Cmd+K Spotlight Modal for power-user quick navigation & AI tools
 */
export default function CommandPalette({ isOpen, onClose }) {
  const { setCurrentView, setFilters, fetchInbox, fetchSent, searchEmails } = useApp()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) onClose()
        else onClose(true) // toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleAction = async (actionFn) => {
    await actionFn()
    onClose()
  }

  const handleSearchSubmit = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    await searchEmails(query.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 p-4 animate-in fade-in">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-xs">

        {/* Input header */}
        <form onSubmit={handleSearchSubmit} className="p-4 border-b border-[#30363d] flex items-center gap-3 bg-[#0d1117]">
          <Search size={16} className="text-indigo-400 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search emails (e.g., 'unread', 'q3 report', 'compose')..."
            className="flex-1 bg-transparent text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none"
          />
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e] border border-[#30363d]">ESC</span>
          <button type="button" onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]">
            <X size={16} />
          </button>
        </form>

        {/* Action Options List */}
        <div className="p-3 max-h-80 overflow-y-auto space-y-1">
          <p className="text-[10px] font-semibold text-[#8b949e] uppercase px-3 py-1 tracking-wider">Quick Actions</p>

          <button
            onClick={() => handleAction(() => setCurrentView('compose'))}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <PenSquare size={14} className="text-indigo-400" />
              <span>Compose New Email</span>
            </div>
            <span className="text-[10px] text-[#8b949e] font-mono">C</span>
          </button>

          <button
            onClick={() => handleAction(() => { setFilters({ unreadOnly: true }); fetchInbox(); })}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Filter size={14} className="text-purple-400" />
              <span>Filter Unread Emails</span>
            </div>
            <span className="text-[10px] text-[#8b949e] font-mono">U</span>
          </button>

          <button
            onClick={() => handleAction(() => { setCurrentView('inbox'); fetchInbox(); })}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Inbox size={14} className="text-indigo-400" />
              <span>Go to Inbox</span>
            </div>
            <span className="text-[10px] text-[#8b949e] font-mono">I</span>
          </button>

          <button
            onClick={() => handleAction(() => { setCurrentView('sent'); fetchSent(); })}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Send size={14} className="text-emerald-400" />
              <span>Go to Sent Folder</span>
            </div>
            <span className="text-[10px] text-[#8b949e] font-mono">S</span>
          </button>

          <button
            onClick={() => handleAction(() => setCurrentView('starred'))}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles size={14} className="text-amber-400" />
              <span>Go to Starred</span>
            </div>
            <span className="text-[10px] text-[#8b949e] font-mono">T</span>
          </button>

          <button
            onClick={() => handleAction(() => setCurrentView('drafts'))}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <PenSquare size={14} className="text-purple-400" />
              <span>Go to Drafts</span>
            </div>
            <span className="text-[10px] text-[#8b949e] font-mono">D</span>
          </button>

          <button
            onClick={() => handleAction(() => setCurrentView('ai'))}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles size={14} className="text-cyan-400" />
              <span>Open AI Insights &amp; Digest</span>
            </div>
            <span className="text-[10px] text-[#8b949e] font-mono">A</span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between text-[11px] text-[#8b949e]">
          <div className="flex items-center gap-1">
            <Sparkles size={12} className="text-indigo-400" />
            <span>Aether Command Palette</span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[#21262d] text-[#e6edf3]">Ctrl+K</kbd> anytime</span>
          </div>
        </div>

      </div>
    </div>
  )
}
