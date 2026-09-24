import React from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Notification from '../ui/Notification'
import AIAssistant from '../ai/AIAssistant'

export default function Layout({ children }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0d1117]">
      {/* Registers AI Context & Actions */}
      <AIAssistant />

      {/* Header Bar */}
      <Header />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-[#0d1117]">
          {children}
        </main>
      </div>

      {/* Global Toast Notifications */}
      <Notification />
    </div>
  )
}
