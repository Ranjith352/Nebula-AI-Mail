import React, { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const ICONS = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
}

const COLORS = {
  success: 'bg-[#161b22] border-[#3fb950]/40 text-[#3fb950]',
  error:   'bg-[#161b22] border-[#f85149]/40 text-[#f85149]',
  info:    'bg-[#161b22] border-indigo-500/40 text-indigo-400',
}

export default function Notification() {
  const { notification, setNotification } = useApp()

  if (!notification) return null

  const { message, type = 'info' } = notification
  const Icon = ICONS[type] || Info

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl shadow-black/50 max-w-sm glass ${COLORS[type]}`}>
        <Icon size={16} className="flex-shrink-0" />
        <p className="text-sm font-medium text-[#e6edf3]">{message}</p>
        <button
          onClick={() => setNotification(null)}
          className="ml-2 text-[#8b949e] hover:text-[#e6edf3] transition-colors flex-shrink-0"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
