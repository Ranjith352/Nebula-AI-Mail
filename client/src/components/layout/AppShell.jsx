import React, { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import useSocket from '../../hooks/useSocket'
import Header from './Header'
import Sidebar from './Sidebar'
import InboxView from '../mail/InboxView'
import SentView from '../mail/SentView'
import ComposeView from '../mail/ComposeView'
import EmailDetail from '../mail/EmailDetail'
import AIInsightsView from '../mail/AIInsightsView'
import AIAssistant from '../ai/AIAssistant'
import LoginPage from '../auth/LoginPage'
import Notification from '../ui/Notification'
import CommandPalette from '../ui/CommandPalette'

/**
 * AppShell — Gmail Style Workspace Layout:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Header Bar (Brand | Search | Profile)                        │
 * ├──────────────┬───────────────────────────┬──────────────────┤
 * │ Sidebar      │ Main Content              │ AI Assistant     │
 * └──────────────┴───────────────────────────┴──────────────────┘
 */
export default function AppShell() {
  const { user, authChecked, checkAuth, currentView, fetchInbox } = useApp()
  const [showAIPanel, setShowAIPanel] = useState(true)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Initialise socket real-time connection
  useSocket()

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Fetch inbox once authenticated
  useEffect(() => {
    if (user) fetchInbox()
  }, [user, fetchInbox])

  /* ── While checking auth ──────────────────────────────────────── */
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0e1219]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#8b949e] text-sm font-medium">Loading Nebula AI Mail...</p>
        </div>
      </div>
    )
  }

  /* ── Not logged in ────────────────────────────────────────────── */
  if (!user) return <LoginPage />

  /* ── Main Gmail App Workspace ─────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0e1219] text-[#e6edf3]">
      {/* Top Header Bar */}
      <Header onOpenCommandPalette={() => setShowCommandPalette(true)} />

      {/* Main 3-Column Workspace */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Column 1: Left Gmail Sidebar */}
        <Sidebar onOpenCommandPalette={() => setShowCommandPalette(true)} />

        {/* Column 2: Center Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-[#0e1219]">
          {currentView === 'sent' && <SentView />}
          {currentView === 'compose' && <ComposeView />}
          {(currentView === 'detail' || currentView === 'email') && <EmailDetail />}
          {currentView === 'ai' && <AIInsightsView />}
          {(!['sent', 'compose', 'detail', 'email', 'ai'].includes(currentView)) && <InboxView />}
        </main>


        {/* Column 3: Right AI Co-Pilot Panel */}
        {showAIPanel ? (
          <AIAssistant isDocked={true} onToggleDock={() => setShowAIPanel(false)} />
        ) : (
          <AIAssistant isDocked={false} onToggleDock={() => setShowAIPanel(true)} />
        )}
      </div>

      {/* Command Palette Modal (Ctrl+K) */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={(val) => setShowCommandPalette(typeof val === 'boolean' ? val : false)}
      />

      {/* Toast notifications */}
      <Notification />
    </div>
  )
}

