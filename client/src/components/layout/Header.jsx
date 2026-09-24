import React, { useState } from 'react'
import {
  Search, SlidersHorizontal, Sparkles, LogOut,
  HelpCircle, Settings, Bell, X, Wifi, ShieldCheck, RefreshCw
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function Header({ onOpenCommandPalette }) {
  const { user, logout, searchEmails, fetchInbox, syncAll, loadingInbox, syncStatusText, isAutoSyncing } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const handleSearchSubmit = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      fetchInbox()
      return
    }
    setIsSearching(true)
    await searchEmails(searchQuery)
    setIsSearching(false)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    fetchInbox()
  }

  return (
    <header className="h-[64px] px-4 bg-[#11161d] border-b border-[#262c36] flex items-center justify-between gap-4 flex-shrink-0 select-none z-20 relative">
      {/* ── Left: App Brand & Status ────────────────────────────── */}
      <div className="flex items-center gap-3 w-[240px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles size={16} />
          </div>
          <span className="font-bold text-base text-white tracking-tight">Nebula AI Mail</span>
        </div>

        {/* Socket.IO Real-time Connection Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Real-time</span>
        </div>
      </div>

      {/* ── Center: Gmail Floating Search Bar ───────────────────── */}
      <div className="flex-1 max-w-2xl">
        <form onSubmit={handleSearchSubmit} className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b949e] group-focus-within:text-indigo-400 transition-colors">
            <Search size={17} />
          </div>

          <input
            id="global-gmail-search-input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search mail, sender, subject, or type AI commands..."
            className="w-full bg-[#181f2a] focus:bg-[#1c2432] text-white text-sm placeholder-[#8b949e] pl-10 pr-20 py-2.5 rounded-2xl border border-[#262c36] focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner transition-all duration-200"
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="p-1 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#262c36] transition-colors"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="p-1.5 rounded-xl text-[#8b949e] hover:text-indigo-400 hover:bg-[#262c36] transition-colors"
              title="Advanced Filter Options"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </form>
      </div>

      {/* ── Right: Header Quick Action Tools & Profile Dropdown ─── */}
      <div className="flex items-center gap-2">
        {/* Auto-sync status badge */}
        {syncStatusText && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#181f2a] border border-[#262c36] text-[11px] font-medium text-[#8b949e]">
            {isAutoSyncing ? (
              <RefreshCw size={12} className="text-indigo-400 animate-spin flex-shrink-0" />
            ) : (
              <ShieldCheck size={12} className="text-emerald-400 flex-shrink-0" />
            )}
            <span className="truncate">{syncStatusText}</span>
          </div>
        )}

        {/* Full Gmail Sync Button */}
        <button
          id="full-sync-gmail-btn"
          onClick={syncAll}
          disabled={loadingInbox || isAutoSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-all disabled:opacity-50"
          title="Force Full Gmail Sync (Recovery)"
        >
          <RefreshCw size={14} className={loadingInbox ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Sync Gmail</span>
        </button>

        {/* Command Palette trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181f2a] hover:bg-[#202734] border border-[#262c36] text-xs text-[#8b949e] hover:text-white transition-all"
          title="Command Palette (Ctrl+K)"
        >
          <Sparkles size={13} className="text-indigo-400" />
          <span className="font-mono text-[11px] font-semibold">Ctrl+K</span>
        </button>

        {/* Notifications */}
        <button
          className="p-2 rounded-xl text-[#8b949e] hover:text-white hover:bg-[#181f2a] transition-colors relative"
          title="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-[#11161d]" />
        </button>

        {/* User Account Avatar & Dropdown */}
        {user && (
          <div className="relative ml-1">
            <button
              id="header-user-menu-btn"
              onClick={() => setShowProfileMenu(prev => !prev)}
              className="flex items-center gap-2 p-1 rounded-2xl hover:bg-[#181f2a] border border-transparent hover:border-[#262c36] transition-all"
            >
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full ring-2 ring-indigo-500/40 object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow">
                  {user.name?.[0] || 'U'}
                </div>
              )}
            </button>

            {/* Profile Dropdown Card */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-[#181f2a] border border-[#262c36] rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3 pb-3 border-b border-[#262c36]">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full ring-2 ring-indigo-500/40 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow">
                      {user.name?.[0] || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{user.name}</p>
                    <p className="text-[#8b949e] text-xs truncate">{user.email}</p>
                  </div>
                </div>

                <div className="py-2 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#8b949e] px-2 py-1.5">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    <span>OAuth2 Authenticated</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#8b949e] px-2 py-1.5">
                    <Wifi size={14} className="text-indigo-400" />
                    <span>Socket.IO Sync Active</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#262c36]">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

