import React, { useState, useEffect, useRef } from 'react'
import { Send, X, Loader2, Bot, CheckCircle2, AlertCircle, Mail, RotateCcw } from 'lucide-react'
import { useApp } from '../../context/AppContext'

/**
 * Standard Email Address Validator Regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * ComposeView — Controlled React Component for Email Composition & Sending
 *
 * Flow:
 * React Form (Controlled State)
 *   ↓
 * POST /api/emails/send
 *   ↓
 * Express Server (auth check & routing)
 *   ↓
 * Gmail Service (builds RFC 2822 message)
 *   ↓
 * Google Gmail API (users.messages.send)
 *   ↓
 * Real Email Delivered
 */
export default function ComposeView() {
  const {
    composeData,
    setComposeData,
    sendEmail,
    sendingEmail,
    saveDraft,
    deleteDraft,
    setCurrentView,
  } = useApp()

  const [savingDraft, setSavingDraft] = useState(false)

  // 1. Controlled React State for Form Fields
  const [formData, setFormData] = useState({
    to: composeData.to || '',
    subject: composeData.subject || '',
    body: composeData.body || '',
  })

  // 2. Field-Level Validation State
  const [errors, setErrors] = useState({ to: '', subject: '' })

  // 3. Send Lifecycle State: 'idle' | 'validating' | 'sending' | 'success' | 'error'
  const [sendState, setSendState] = useState('idle')
  const [serverError, setServerError] = useState('')
  const [sentMessageId, setSentMessageId] = useState('')

  // 4. Duplicate-Send Protection Lock
  const isSubmittingRef = useRef(false)
  const toInputRef = useRef(null)

  // Sync controlled state when AI pre-fills composeData via CopilotKit
  useEffect(() => {
    setFormData({
      to: composeData.to || '',
      subject: composeData.subject || '',
      body: composeData.body || '',
    })
  }, [composeData.to, composeData.subject, composeData.body])

  // Focus To field on mount if empty
  useEffect(() => {
    if (!formData.to) {
      toInputRef.current?.focus()
    }
  }, [])

  // Controlled change handler
  const handleChange = (field) => (e) => {
    const value = e.target.value
    setFormData(prev => ({ ...prev, [field]: value }))
    setComposeData(prev => ({ ...prev, [field]: value }))

    // Clear validation error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
    if (serverError) {
      setServerError('')
    }
    if (sendState === 'error') {
      setSendState('idle')
    }
  }

  // Client-Side Email & Form Validation (supports single or multiple comma/semicolon-separated email IDs)
  const validateForm = () => {
    const newErrors = { to: '', subject: '' }
    let isValid = true

    const trimmedTo = formData.to.trim()
    if (!trimmedTo) {
      newErrors.to = 'Recipient email address ("To") is required.'
      isValid = false
    } else {
      const parts = trimmedTo.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
      if (parts.length === 0) {
        newErrors.to = 'Recipient email address ("To") is required.'
        isValid = false
      } else {
        const invalidParts = parts.filter(part => {
          const match = part.match(/<(.+?)>/)
          const emailCandidate = (match ? match[1] : part).trim()
          return !EMAIL_REGEX.test(emailCandidate)
        })
        if (invalidParts.length > 0) {
          newErrors.to = `Invalid email address(es): ${invalidParts.map(e => `"${e}"`).join(', ')}. Please check all recipient IDs.`
          isValid = false
        }
      }
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject line is required.'
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  // Form Submission with Duplicate-Send Protection
  const handleSend = async (e) => {
    if (e) e.preventDefault()

    // DUPLICATE-SEND PROTECTION: Prevent duplicate calls if already submitting
    if (isSubmittingRef.current || sendState === 'sending' || sendingEmail) {
      console.warn('[ComposeView] Duplicate send blocked — request already in flight.')
      return
    }

    // Email validation check
    setSendState('validating')
    if (!validateForm()) {
      setSendState('idle')
      return
    }

    // Acquire submit lock & set loading state
    isSubmittingRef.current = true
    setSendState('sending')
    setServerError('')

    try {
      // Call AppContext sendEmail -> POST /api/emails/send
      const result = await sendEmail({
        to: formData.to.trim(),
        subject: formData.subject.trim(),
        body: formData.body,
      })

      if (result.success) {
        setSendState('success')
        setSentMessageId(result.messageId || 'SENT_GMAIL_API')

        // Clear form state
        setComposeData({ to: '', subject: '', body: '' })
        setFormData({ to: '', subject: '', body: '' })

        // Automatically navigate back to inbox after success notification
        setTimeout(() => {
          setCurrentView('inbox')
        }, 2200)
      } else {
        setSendState('error')
        setServerError(result.error || 'Failed to send email through Gmail API.')
      }
    } catch (err) {
      setSendState('error')
      setServerError(err.message || 'Network error while reaching email server.')
    } finally {
      // Release submit lock
      isSubmittingRef.current = false
    }
  }

  // Save Draft Action
  const handleSaveDraft = async () => {
    if (savingDraft) return
    setSavingDraft(true)
    try {
      if (saveDraft) {
        await saveDraft({
          to: formData.to,
          subject: formData.subject,
          body: formData.body,
        })
      }
    } catch (err) {
      console.error('[ComposeView] Save draft error:', err)
    } finally {
      setSavingDraft(false)
    }
  }

  // Cancel / Discard Action
  const handleCancel = () => {
    setComposeData({ to: '', subject: '', body: '' })
    setFormData({ to: '', subject: '', body: '' })
    setErrors({ to: '', subject: '' })
    setSendState('idle')
    setServerError('')
    setCurrentView('inbox')
  }

  const handleDiscard = () => {
    handleCancel()
  }

  const isAIFilled = composeData.to || composeData.subject || composeData.body
  const isSending = sendState === 'sending' || sendingEmail

  return (
    <div className="flex flex-col h-full view-enter bg-[#0d1117] text-[#e6edf3]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#30363d] bg-[#161b22] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Mail size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#e6edf3] tracking-tight">New Message</h2>
            <p className="text-xs text-[#8b949e]">Compose and send via Gmail API</p>
          </div>
          {isAIFilled && (
            <span className="ml-2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm">
              <Bot size={12} className="text-indigo-400 animate-pulse" />
              AI Assistant Filled
            </span>
          )}
        </div>
        <button
          id="compose-cancel-top-btn"
          onClick={handleCancel}
          disabled={isSending}
          className="p-2 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors disabled:opacity-50"
          title="Cancel compose"
        >
          <X size={18} />
        </button>
      </div>

      {/* Notifications Banners & Human-In-The-Loop Confirmation */}
      <div className="px-6 pt-4 space-y-3 flex-shrink-0 max-w-3xl w-full mx-auto">
        {/* Human-In-The-Loop Review Email Card */}
        {isAIFilled && sendState === 'idle' && (
          <div className="bg-[#161b22] border border-indigo-500/40 rounded-2xl p-5 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-2.5">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Bot size={16} className="text-indigo-400 animate-pulse" />
                <span>Review email (Human-In-The-Loop Approval)</span>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Action Required
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-[#e6edf3]">
              <div><span className="text-[#8b949e] font-medium">To:</span> <span className="font-mono text-indigo-300 font-medium">{formData.to}</span></div>
              <div><span className="text-[#8b949e] font-medium">Subject:</span> <span className="font-semibold">{formData.subject}</span></div>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 text-[#8b949e] leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto mt-2 font-sans">
                {formData.body || '(empty message body)'}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#30363d]/50">
              <p className="text-[11px] text-[#8b949e]">Only after explicit confirmation will the email be sent.</p>
              <div className="flex items-center gap-2">
                <button
                  id="review-card-cancel-btn"
                  type="button"
                  onClick={handleCancel}
                  disabled={isSending}
                  className="bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="review-card-send-btn"
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
                  className="btn-gradient text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all"
                >
                  <Send size={13} />
                  Send Email
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Notification */}
        {sendState === 'success' && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-300">Email sent successfully via Gmail API!</p>
                <p className="text-xs text-emerald-400/80 font-mono mt-0.5">Gmail Message ID: {sentMessageId}</p>
              </div>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Returning to Inbox...
            </span>
          </div>
        )}

        {/* Failure Notification */}
        {sendState === 'error' && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-rose-300">Email Send Failed</p>
                <p className="text-xs text-rose-400/90 mt-0.5">{serverError || 'Failed to send email. Please check fields and try again.'}</p>
              </div>
            </div>
            <button
              onClick={handleSend}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition-colors"
            >
              <RotateCcw size={12} />
              Retry
            </button>
          </div>
        )}
      </div>


      {/* Main Form Body */}
      <form onSubmit={handleSend} className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
        <div className="max-w-3xl w-full mx-auto space-y-4 bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-xl">

          {/* To Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="compose-to" className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
                To <span className="text-rose-400">*</span>
              </label>
              {errors.to && (
                <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.to}
                </span>
              )}
            </div>
            <input
              id="compose-to"
              ref={toInputRef}
              type="text"
              name="to"
              value={formData.to}
              onChange={handleChange('to')}
              disabled={isSending}
              placeholder="user1@example.com, user2@cit.edu.in"
              className={`w-full bg-[#0d1117] text-[#e6edf3] text-sm rounded-xl px-4 py-2.5 border ${
                errors.to ? 'border-rose-500 focus:ring-rose-500/20' : 'border-[#30363d] focus:border-indigo-500'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
            />
          </div>

          {/* Subject Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="compose-subject" className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
                Subject <span className="text-rose-400">*</span>
              </label>
              {errors.subject && (
                <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.subject}
                </span>
              )}
            </div>
            <input
              id="compose-subject"
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange('subject')}
              disabled={isSending}
              placeholder="Subject line"
              className={`w-full bg-[#0d1117] text-[#e6edf3] text-sm rounded-xl px-4 py-2.5 border ${
                errors.subject ? 'border-rose-500 focus:ring-rose-500/20' : 'border-[#30363d] focus:border-indigo-500'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
            />
          </div>

          {/* Body Field */}
          <div className="space-y-1.5 flex-1 flex flex-col min-h-[220px] pt-2">
            <label htmlFor="compose-body" className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
              Message Body
            </label>
            <textarea
              id="compose-body"
              name="body"
              value={formData.body}
              onChange={handleChange('body')}
              disabled={isSending}
              placeholder="Write your email message here..."
              rows={10}
              className="w-full flex-1 bg-[#0d1117] text-[#e6edf3] text-sm rounded-xl p-4 border border-[#30363d] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-y disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="max-w-3xl w-full mx-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            {/* Send Button */}
            <button
              id="compose-send-btn"
              type="submit"
              onClick={handleSend}
              disabled={isSending || sendState === 'success'}
              className="btn-gradient text-white text-sm font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSending ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Sending Email...</span>
                </>
              ) : sendState === 'success' ? (
                <>
                  <CheckCircle2 size={16} className="text-white" />
                  <span>Sent!</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Send Email</span>
                </>
              )}
            </button>

            {/* Save Draft Action */}
            <button
              id="compose-save-draft-btn"
              type="button"
              onClick={handleSaveDraft}
              disabled={isSending || savingDraft}
              className="bg-[#21262d] hover:bg-[#30363d] text-purple-300 border border-purple-500/30 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
            >
              Save Draft
            </button>

            {/* Discard Action */}
            <button
              id="compose-discard-btn"
              type="button"
              onClick={handleDiscard}
              disabled={isSending}
              className="text-[#8b949e] hover:text-rose-400 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#21262d] transition-colors"
            >
              Discard
            </button>
          </div>

          <div className="text-xs text-[#484f58] font-mono">
            {isSending ? 'Transmitting via Gmail API...' : savingDraft ? 'Saving to Gmail Drafts...' : 'Ready'}
          </div>
        </div>
      </form>
    </div>
  )
}
