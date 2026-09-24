import React from 'react'
import { Mail, Send, X } from 'lucide-react'

/**
 * EmailPreviewCard — Human-In-The-Loop explicit approval card before sending.
 * Props: draft { to, subject, body }, onSend, onCancel
 */
export default function EmailPreviewCard({ draft, onSend, onCancel }) {
  return (
    <div className="bg-[#161b22] border border-indigo-500/40 rounded-2xl p-4 my-2 shadow-2xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#30363d] pb-2">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
          <Mail size={15} />
          <span>Review email</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
          Confirmation Required
        </span>
      </div>

      {/* Fields */}
      <div className="space-y-1.5 text-xs text-[#e6edf3]">
        <div><span className="text-[#8b949e] font-medium">To:</span> <span className="font-mono text-indigo-300">{draft?.to || '(empty)'}</span></div>
        <div><span className="text-[#8b949e] font-medium">Subject:</span> <span className="font-semibold">{draft?.subject || '(empty)'}</span></div>
        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-2.5 mt-2 text-[#8b949e] leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">
          {draft?.body || '(empty message body)'}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#30363d]/40">
        <button
          id="preview-card-cancel-btn"
          onClick={onCancel}
          className="bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <X size={12} />
          Cancel
        </button>
        <button
          id="preview-card-send-btn"
          onClick={onSend}
          className="btn-gradient text-white text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md hover:scale-105 transition-all"
        >
          <Send size={12} />
          Send
        </button>
      </div>
    </div>
  )
}

