import React from 'react'
import { Bot, User as UserIcon } from 'lucide-react'

export default function AIMessage({ sender, content, timestamp }) {
  const isUser = sender === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-indigo-600 text-white' : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
      }`}>
        {isUser ? <UserIcon size={14} /> : <Bot size={14} />}
      </div>

      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-md ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-none'
          : 'bg-[#161b22] border border-[#30363d] text-[#e6edf3] rounded-tl-none'
      }`}>
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        {timestamp && (
          <span className="block text-[10px] opacity-60 mt-1 text-right font-mono">
            {timestamp}
          </span>
        )}
      </div>
    </div>
  )
}
