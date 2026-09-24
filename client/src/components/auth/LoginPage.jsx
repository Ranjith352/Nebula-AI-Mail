import React, { useEffect, useState } from 'react'
import { Zap, Mail, Sparkles, Shield, AlertCircle, Loader2 } from 'lucide-react'

/**
 * LoginPage — Google OAuth 2.0 entry point.
 *
 * Security:
 *  - The "Connect Gmail" link redirects to Express /auth/google (server-side).
 *  - The browser is then redirected to Google's consent screen by Express.
 *  - NO client secret, access token, or refresh token ever touches this file.
 *  - The only thing this page does is: navigate to /auth/google on the server.
 */

// Server base URL from env — defaults to same-origin proxy in dev (Vite proxy)
// NEVER put OAuth client secret or API keys here.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000'

const FEATURES = [
  { icon: Sparkles, label: 'AI fills compose form from natural language' },
  { icon: Mail,     label: 'Real-time inbox sync via Gmail Push API' },
  { icon: Shield,   label: 'Secure OAuth 2.0 — your tokens stay server-side' },
]

export default function LoginPage() {
  const [authError, setAuthError] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Show a user-friendly message when Google redirects back with ?error=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err === 'auth_failed') {
      setAuthError('Google sign-in was cancelled or denied. Please try again.')
      // Clean the URL so error doesn't persist on refresh
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleGoogleLogin = () => {
    setIsRedirecting(true)
    setAuthError('')
    // Hard navigation — Express /auth/google redirects to Google consent screen.
    // This is intentionally a full page navigation, not an axios call.
    window.location.href = `${SERVER_URL}/auth/google`
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      {/* ── Left panel — branding ─────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-[#161b22] border-r border-[#30363d] relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">Nebula Mail</span>
          </div>

          <h1 className="text-4xl font-bold text-[#e6edf3] leading-tight mb-4">
            Your inbox,<br />
            <span className="gradient-text">supercharged with AI</span>
          </h1>
          <p className="text-[#8b949e] text-lg leading-relaxed">
            Compose, search, and manage your Gmail with natural language. Just tell Nebula what you need.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-4">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-indigo-400" />
              </div>
              <p className="text-[#8b949e] text-sm">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — login ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-10 justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">Nebula Mail</span>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-[#e6edf3] mb-2">Welcome back</h2>
            <p className="text-[#8b949e] text-sm mb-6">
              Sign in with your Google account to access your Gmail inbox.
            </p>

            {/* Error banner */}
            {authError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs mb-6">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* OAuth button — navigates to Express server, which redirects to Google */}
            <button
              id="google-login-btn"
              onClick={handleGoogleLogin}
              disabled={isRedirecting}
              className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isRedirecting ? (
                <>
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                  <span>Redirecting to Google…</span>
                </>
              ) : (
                <>
                  {/* Official Google "G" logo */}
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2045C17.64 8.5664 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.2045Z" fill="#4285F4"/>
                    <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
                    <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5932 3.68182 9C3.68182 8.4068 3.78409 7.83 3.96409 7.29V4.9582H0.957275C0.347727 6.1732 0 7.5477 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                    <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9255L15.0218 2.3441C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9582L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {/* Demo Mode Button */}
            <button
              id="demo-login-btn"
              onClick={() => {
                const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000'
                window.location.href = `${serverUrl}/auth/demo-login`
              }}
              className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-medium text-xs border border-indigo-500/30 transition-all"
            >
              <Sparkles size={14} />
              Try Sandbox Demo Mode (Instant Access)
            </button>

            {/* Scope disclosure */}
            <div className="mt-6 p-3 rounded-xl bg-[#161b22] border border-[#30363d]">
              <p className="text-[#8b949e] text-xs leading-relaxed font-medium mb-2 flex items-center gap-1.5">
                <Shield size={11} className="text-indigo-400" />
                Permissions requested
              </p>
              <ul className="text-[#484f58] text-[11px] space-y-1">
                <li>• Read and manage your Gmail messages and settings</li>
                <li>• Send email on your behalf</li>
                <li>• View your basic profile and email address</li>
              </ul>
            </div>

            <p className="text-center text-[#8b949e] text-[11px] mt-5 leading-relaxed">
              Your OAuth tokens are stored server-side only and never exposed to the browser.
            </p>
          </div>

          <p className="text-center text-[#484f58] text-xs mt-4">
            Powered by Groq · CopilotKit · Gmail API
          </p>
        </div>
      </div>
    </div>
  )
}
