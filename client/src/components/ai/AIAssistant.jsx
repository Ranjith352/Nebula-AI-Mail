import React, { useState, useRef, useEffect } from 'react'
import {
  Sparkles, X, Send, Bot, User as UserIcon, Loader2,
  ArrowRight, PanelRightClose, Mic, MicOff, Check, AlertCircle, Mail, Eye
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { dispatchAIAction, AI_ACTIONS } from '../../services/aiDispatcher'
import { sendAssistantMessage } from '../../services/api'
import EmailPreviewCard from './EmailPreviewCard'
import ConfirmationCard from './ConfirmationCard'

const QUICK_PROMPTS = [
  "Compose an email to alice@example.com about Q3 Report",
  "Show only unread emails from this week",
  "Reply to this email saying I will attend at 3pm",
  "Find emails from Sarah about project update",
  "Go to sent folder",
]

export default function AIAssistant({ isDocked = true, onToggleDock }) {
  const appContext = useApp()
  const {
    currentView, openedEmail,
    composeData, displayedEmails,
    filters, user, showNotification,
    openEmail,
  } = appContext

  const [isOpen, setIsOpen] = useState(true)
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm Nebula AI, your intelligent email co-pilot. I can control the app, compose emails, filter inbox views, and reply on your behalf. Speak or type a command!",
    },
  ])

  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  /* ── Voice Input Handler via Web Speech API ─────────────────────── */
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      showNotification('Voice recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.', 'error')
      return
    }

    if (isListening) {
      try { recognitionRef.current?.stop() } catch (_) {}
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        showNotification('🎙️ Listening... Speak your request now.', 'info')
      }

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('')
        setInputMessage(transcript)
      }

      recognition.onerror = (event) => {
        console.warn('[Speech Recognition Error]', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('[Speech Recognition Error]', err)
      setIsListening(false)
    }
  }

  // Construct active context snapshot for AI decisions
  const getContextSnapshot = () => ({
    currentView: currentView || 'inbox',
    currentEmailId: openedEmail?.id || null,
    currentEmail: openedEmail ? {
      sender: openedEmail.from || openedEmail.sender || null,
      subject: openedEmail.subject || null,
      snippet: openedEmail.snippet || null,
    } : null,
    filters: {
      unread: filters?.unreadOnly || false,
      sender: filters?.sender || null,
      keyword: filters?.keyword || null,
      dateRange: filters?.dateRange || 'all',
    },
    composeState: {
      to: composeData?.to || '',
      subject: composeData?.subject || '',
      body: composeData?.body || '',
    },
    user: user ? { name: user.name, email: user.email } : null,
  })

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim()
    if (!text || loading) return

    if (isListening) {
      try { recognitionRef.current?.stop() } catch (_) {}
      setIsListening(false)
    }

    const userMsg = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    setMessages(prev => [...prev, userMsg])
    setInputMessage('')
    setLoading(true)

    try {
      const context = getContextSnapshot()
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      // Call Express backend endpoint POST /api/assistant/chat (Groq LLM)
      const data = await sendAssistantMessage(text, history, context)

      let assistantText = data.message || "I've processed your request."
      let actionResult = null
      let draftData = null
      let emailPreviews = []
      let needsConfirmation = false

      // If backend returned a structured tool call, execute via Central AI Action Dispatcher
      if (data.toolCall && data.toolCall.name) {
        const toolName = data.toolCall.name
        const toolArgs = data.toolCall.args || {}

        try {
          actionResult = await dispatchAIAction(toolName, toolArgs, appContext)

          // Always prioritize canonical action message over raw LLM fallback text
          if (actionResult?.message) {
            assistantText = actionResult.message
          }

          // Attach draft preview card & confirmation prompt for compose, reply, and forward actions
          const isComposeAction = ['composeEmail', 'replyToEmail', 'forwardEmail'].includes(toolName) ||
            [AI_ACTIONS.COMPOSE_EMAIL, AI_ACTIONS.REPLY_TO_EMAIL, AI_ACTIONS.FORWARD_EMAIL].includes(actionResult?.action)

          if (isComposeAction && actionResult?.message?.includes('send it')) {
            draftData = {
              to: toolArgs.to || appContext.composeData?.to || '',
              subject: toolArgs.subject || appContext.composeData?.subject || '',
              body: toolArgs.body || appContext.composeData?.body || '',
            }
            needsConfirmation = true
          }

          if (toolName === 'confirmSend' || actionResult?.action === AI_ACTIONS.CONFIRM_SEND) {
            if (!actionResult?.success) {
              needsConfirmation = true
            }
          }

          if (toolName === 'searchEmails' || toolName === 'filterInbox' || actionResult?.action === AI_ACTIONS.FILTER_EMAILS) {
            // Attach top email previews from actual search results
            emailPreviews = (actionResult?.emails || []).slice(0, 3)
          }

        } catch (dispatchErr) {
          console.error('[AI Dispatcher Error]', dispatchErr.message)
          actionResult = { success: false, error: dispatchErr.message }
        }
      }

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantText,
          toolCall: data.toolCall,
          actionResult,
          draftData,
          emailPreviews,
          needsConfirmation,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch (err) {
      console.error('[AI Assistant Error]', err)
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Nebula AI Co-Pilot is currently offline. All standard email functions (Inbox, Sent, Compose, Manual Search, and Filters) remain fully operational.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Handle confirmation card click
  const handleConfirmAction = async (msgId, confirmed, draftData) => {
    try {
      const res = await dispatchAIAction('confirmSend', { confirmed, draft: draftData }, appContext)
      showNotification(res.message, confirmed ? 'success' : 'info')
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, needsConfirmation: false, draftData: null, actionResult: res } : m))
    } catch (err) {
      showNotification(err.message, 'error')
    }
  }

  // Render content inner
  const renderContent = () => (
    <div className="flex flex-col h-full bg-[#161b22] border-l border-[#30363d]">
      {/* Header */}
      <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#e6edf3]">Nebula AI Co-Pilot</h3>
            <p className="text-[11px] text-[#8b949e]">Controls UI • Powered by Groq</p>
          </div>
        </div>

        {onToggleDock ? (
          <button
            onClick={onToggleDock}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors"
            title="Toggle Panel"
          >
            <PanelRightClose size={18} />
          </button>
        ) : (
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Chat Messages List (Conversation History) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-indigo-400" />
              </div>
            )}
            <div className={`max-w-[85%] space-y-2`}>
              <div
                className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                    : 'bg-[#21262d] text-[#e6edf3] border border-[#30363d] rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>

                {/* Action Executed Status Badge */}
                {m.actionResult?.message && (
                  <div className="mt-2 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-indigo-400 flex-shrink-0" />
                    <span>✨ {m.actionResult.message}</span>
                  </div>
                )}

                {m.actionResult?.error && (
                  <div className="mt-2 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
                    <span>⚠️ {m.actionResult.error}</span>
                  </div>
                )}
              </div>

              {/* Email Draft Preview Card */}
              {m.draftData && (
                <EmailPreviewCard
                  draft={m.draftData}
                  onSend={() => handleConfirmAction(m.id, true, m.draftData)}
                  onCancel={() => handleConfirmAction(m.id, false, m.draftData)}
                  onEdit={() => {
                    appContext.setComposeData(m.draftData)
                    appContext.setCurrentView('compose')
                  }}
                />
              )}

              {/* Confirmation UI Card */}
              {m.needsConfirmation && (
                <ConfirmationCard
                  title="Confirm Send Email"
                  description={`Send email to ${composeData?.to || 'recipient'} with subject "${composeData?.subject || ''}"?`}
                  onConfirm={() => handleConfirmAction(m.id, true, m.draftData)}
                  onCancel={() => handleConfirmAction(m.id, false, m.draftData)}
                />
              )}

              {/* Rich Email Search Result Cards */}
              {m.emailPreviews?.length > 0 && (
                <div className="space-y-2.5 my-3">
                  <p className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-wider">Search Results ({m.emailPreviews.length}):</p>
                  {m.emailPreviews.map(e => {
                    const rawFrom = e.sender || e.from || 'Unknown'
                    const senderName = rawFrom.replace(/<.*>/, '').trim() || rawFrom
                    const rawDate = e.receivedAt || e.date
                    const dateFormatted = rawDate
                      ? new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Sep 18, 2026'

                    return (
                      <div
                        key={e.id}
                        className="bg-[#0d1117] border border-indigo-500/30 rounded-xl p-3.5 shadow-lg space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between border-b border-[#30363d]/60 pb-1.5">
                          <span className="font-bold text-[#e6edf3] text-xs">{senderName}</span>
                          <span className="text-[10px] text-[#8b949e] font-mono">{dateFormatted}</span>
                        </div>
                        <p className="font-semibold text-indigo-300 text-xs truncate">{e.subject || '(no subject)'}</p>
                        <p className="text-[#8b949e] text-[11px] leading-relaxed line-clamp-2">
                          {e.snippet || e.body || 'Here is the latest update regarding the email message content...'}
                        </p>
                        <div className="pt-1">
                          <button
                            onClick={() => openEmail(e.id)}
                            className="w-full bg-[#21262d] hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm"
                          >
                            <Eye size={12} />
                            Open Email
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

            </div>

            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <UserIcon size={14} className="text-purple-400" />
              </div>
            )}
          </div>
        ))}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center gap-2 text-[#8b949e] text-xs p-2">
            <Loader2 size={14} className="animate-spin text-indigo-400" />
            <span>Nebula AI is thinking & updating UI...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Suggestions */}
      <div className="p-3 border-t border-[#30363d] bg-[#0d1117] overflow-x-auto no-scrollbar flex gap-2 flex-shrink-0">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSendMessage(prompt)}
            disabled={loading}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#21262d] hover:bg-[#30363d] text-[11px] text-[#8b949e] hover:text-[#e6edf3] border border-[#30363d] transition-all flex items-center gap-1.5"
          >
            <span>{prompt}</span>
            <ArrowRight size={10} />
          </button>
        ))}
      </div>

      {/* Input Box with Voice Symbol Button */}
      <div className="p-3 border-t border-[#30363d] bg-[#161b22] flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex items-center gap-2"
        >
          <input
            id="ai-assistant-input"
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={isListening ? "Listening... Speak your command..." : "Ask Nebula AI to compose, search, or open emails..."}
            disabled={loading}
            className={`flex-1 bg-[#0d1117] border rounded-xl px-4 py-2.5 text-xs text-[#e6edf3] placeholder-[#8b949e] focus:outline-none transition-colors ${
              isListening ? 'border-red-500/70 ring-1 ring-red-500/30' : 'border-[#30363d] focus:border-indigo-500'
            }`}
          />

          {/* Voice Input Microphone Button */}
          <button
            id="voice-input-btn"
            type="button"
            onClick={toggleVoiceInput}
            disabled={loading}
            className={`p-2.5 rounded-xl transition-all flex-shrink-0 flex items-center justify-center ${
              isListening
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                : 'bg-[#0d1117] text-[#8b949e] hover:text-[#e6edf3] border border-[#30363d] hover:border-indigo-500/50'
            }`}
            title={isListening ? "Listening... Click to stop" : "Speak to input command"}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          {/* Submit Button */}
          <button
            id="ai-assistant-send-btn"
            type="submit"
            disabled={!inputMessage.trim() || loading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-all flex-shrink-0"
            title="Send Message"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  )

  // In 3-column mode on desktop:
  if (isDocked) {
    return (
      <aside className="w-[360px] xl:w-[400px] flex-shrink-0 h-full hidden md:block">
        {renderContent()}
      </aside>
    )
  }

  // Fallback drawer / floating on smaller screens
  return (
    <>
      <button
        id="nebula-ai-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm shadow-xl hover:shadow-indigo-500/25 hover:scale-105 transition-all duration-200"
      >
        <Sparkles size={18} className="animate-pulse" />
        <span>Ask Nebula AI</span>
      </button>

      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] shadow-2xl transition-all duration-300">
          {renderContent()}
        </div>
      )}
    </>
  )
}


