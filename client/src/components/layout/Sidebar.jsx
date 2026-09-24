import React from 'react'
import {
  Inbox, Send, Plus, LogOut, Zap,
  Star, Clock, FileText, AlertOctagon, Trash2,
  Tag, Sparkles, ChevronRight, HardDrive, Wifi
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

const PRIMARY_NAV = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, color: 'text-indigo-400' },
  { id: 'starred', label: 'Starred', icon: Star, color: 'text-amber-400' },
  { id: 'snoozed', label: 'Snoozed', icon: Clock, color: 'text-sky-400' },
  { id: 'sent', label: 'Sent', icon: Send, color: 'text-emerald-400' },
  { id: 'drafts', label: 'Drafts', icon: FileText, color: 'text-purple-400' },
  { id: 'complaints', label: 'Spam & Complaints', icon: AlertOctagon, color: 'text-rose-400' },
]

const CATEGORY_LABELS = [
  { id: 'primary', label: 'Primary', color: 'bg-indigo-500' },
  { id: 'work', label: 'Work Workspace', color: 'bg-purple-500' },
  { id: 'ai', label: 'AI Insights', color: 'bg-cyan-400' },
  { id: 'updates', label: 'System Updates', color: 'bg-emerald-500' },
]

export default function Sidebar({ onOpenCommandPalette }) {
  const { currentView, setCurrentView, user, logout, inboxEmails, fetchMailbox, labels, setFilters } = useApp()

  const handleNav = (view) => {
    setCurrentView(view)
    fetchMailbox(view)
  }

  const handleCategoryNav = (catId) => {
    if (catId === 'primary') {
      setFilters(prev => ({ ...prev, keyword: '', unreadOnly: false }))
      handleNav('inbox')
    } else if (catId === 'work') {
      setFilters(prev => ({ ...prev, keyword: 'work' }))
      handleNav('inbox')
    } else if (catId === 'ai') {
      setCurrentView('ai')
    } else if (catId === 'updates') {
      setFilters(prev => ({ ...prev, keyword: 'system' }))
      handleNav('inbox')
    }
  }

  const handleUserLabelNav = (labelId) => {
    const viewName = `label:${labelId}`
    setCurrentView(viewName)
    fetchMailbox(viewName)
  }

  // Find label counts from Gmail synced labels collection
  const getLabelStat = (labelId) => labels.find(l => l.id === labelId)

  const inboxLabel = getLabelStat('INBOX')
  const starredLabel = getLabelStat('STARRED')
  const draftLabel = getLabelStat('DRAFT')
  const spamLabel = getLabelStat('SPAM')

  const unreadCount = inboxLabel ? inboxLabel.messagesUnread : inboxEmails.filter(e => !e.isRead).length
  const starredCount = starredLabel ? starredLabel.messagesTotal : inboxEmails.filter(e => e.isStarred).length
  const snoozedCount = inboxEmails.filter(e => e.isSnoozed).length
  const draftsCount = draftLabel ? draftLabel.messagesTotal : inboxEmails.filter(e => e.isDraft).length
  const complaintsCount = spamLabel ? spamLabel.messagesTotal : inboxEmails.filter(e => e.isSpam || e.isComplaint).length

  // Filter user created custom labels
  const userLabels = labels.filter(l => l.type === 'user')

  return (
    <aside className="w-[256px] flex-shrink-0 h-full flex flex-col bg-[#11161d] border-r border-[#262c36] select-none">
      {/* ── Brand / Logo ──────────────────────────────────────────── */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#262c36]/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/25">
            <Zap size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base text-white tracking-tight leading-tight">Nebula AI Mail</span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                PRO
              </span>
            </div>
            <span className="text-[11px] text-[#8b949e] font-medium tracking-wide">Workspace Mail</span>
          </div>
        </div>
      </div>

      {/* ── Gmail Floating Compose Button ─────────────────────────── */}
      <div className="p-4 space-y-2.5">
        <button
          id="compose-btn"
          onClick={() => setCurrentView('compose')}
          className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 px-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Plus size={16} className="text-white stroke-[2.5]" />
          </div>
          <span className="text-sm tracking-wide">Compose</span>
        </button>

        {/* Command Palette Trigger */}
        {onOpenCommandPalette && (
          <button
            id="command-palette-btn"
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-[#8b949e] hover:text-white bg-[#181f2a] hover:bg-[#202734] border border-[#262c36] transition-all group"
            title="Search commands or trigger AI actions"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400 group-hover:rotate-12 transition-transform" />
              <span>Command Palette</span>
            </span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#262c36] text-[#c9d1d9] rounded border border-[#30363d]">Ctrl+K</kbd>
          </button>
        )}
      </div>

      {/* ── Gmail Primary Navigation ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-6">
        <nav className="space-y-1">
          {PRIMARY_NAV.map(({ id, label, icon: Icon, color }) => {
            const active = currentView === id || (currentView === 'detail' && id === 'inbox')
            const count = id === 'inbox' ? unreadCount :
              id === 'starred' ? starredCount :
                id === 'snoozed' ? snoozedCount :
                  id === 'drafts' ? draftsCount :
                    id === 'complaints' ? complaintsCount : null

            return (
              <button
                key={id}
                id={`nav-${id}`}
                onClick={() => handleNav(id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-r-full rounded-l-xl text-sm font-medium transition-all duration-150 ${active
                    ? 'bg-indigo-600/20 text-indigo-300 font-semibold border-l-4 border-indigo-500 shadow-sm'
                    : 'text-[#9ca3af] hover:text-white hover:bg-[#1c232d]'
                  }`}
              >
                <Icon size={18} className={active ? 'text-indigo-400' : color} />
                <span className="flex-1 text-left truncate">{label}</span>
                {count !== null && count > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-indigo-500 text-white' : 'bg-[#262c36] text-[#c9d1d9]'
                    }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* ── Dynamic Gmail User Labels & Category Folders ───────────── */}
        <div className="space-y-2 pt-2 border-t border-[#262c36]/60">
          <div className="px-3 flex items-center justify-between text-[11px] font-bold text-[#8b949e] uppercase tracking-wider">
            <span>Labels &amp; Folders</span>
            <Tag size={12} className="text-[#8b949e]" />
          </div>

          <div className="space-y-1">
            {/* Presets */}
            {CATEGORY_LABELS.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryNav(cat.id)}
                className="w-full flex items-center gap-3 px-3.5 py-1.5 rounded-lg text-xs text-[#9ca3af] hover:text-white hover:bg-[#1c232d] transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${cat.color} flex-shrink-0`} />
                <span className="truncate">{cat.label}</span>
              </button>
            ))}

            {/* Custom User Gmail Labels */}
            {userLabels.map(l => {
              const active = currentView === `label:${l.id}`
              return (
                <button
                  key={l.id}
                  onClick={() => handleUserLabelNav(l.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-1.5 rounded-lg text-xs transition-colors ${
                    active ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-[#9ca3af] hover:text-white hover:bg-[#1c232d]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  <span className="truncate flex-1 text-left">{l.name}</span>
                  {l.messagesTotal > 0 && (
                    <span className="text-[10px] font-mono text-[#8b949e]">{l.messagesTotal}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Storage Usage Meter (Gmail Style) ────────────────────── */}
        <div className="px-3 py-3 rounded-xl bg-[#181f2a] border border-[#262c36] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#8b949e]">
            <span className="flex items-center gap-1.5 text-white font-medium">
              <HardDrive size={13} className="text-indigo-400" />
              Storage
            </span>
            <span className="text-[11px] font-mono">4.2 GB / 15 GB</span>
          </div>
          <div className="w-full h-1.5 bg-[#262c36] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full w-[28%]" />
          </div>
          <p className="text-[10px] text-[#8b949e]">28% used • Free tier plan</p>
        </div>
      </div>

      {/* ── User Account Drawer & Status ──────────────────────────── */}
      <div className="p-3 border-t border-[#262c36] bg-[#0e1219]">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-[#181f2a] border border-[#262c36]">
          {user?.picture ? (
            <img src={user.picture} alt={user.name} className="w-9 h-9 rounded-full ring-2 ring-indigo-500/40 flex-shrink-0 object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow">
              {user?.name?.[0] || 'U'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-white text-xs font-semibold truncate">{user?.name || 'User'}</p>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Socket Connected" />
            </div>
            <p className="text-[#8b949e] text-[11px] truncate">{user?.email}</p>
          </div>
          <button
            id="logout-btn"
            onClick={logout}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}


