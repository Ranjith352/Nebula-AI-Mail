import React from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'

export default function ConfirmationCard({ title, description, onConfirm, onCancel }) {
  return (
    <div className="bg-[#161b22] border border-amber-500/40 rounded-xl p-4 my-2 shadow-lg space-y-3">
      <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
        <AlertTriangle size={15} />
        <span>{title}</span>
      </div>

      <p className="text-xs text-[#8b949e] leading-relaxed">{description}</p>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onConfirm}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <Check size={12} />
          Yes, proceed
        </button>
        <button
          onClick={onCancel}
          className="bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <X size={12} />
          Cancel
        </button>
      </div>
    </div>
  )
}
