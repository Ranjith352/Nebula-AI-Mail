import React, { useEffect, useState } from 'react'
import {
  Sparkles, RefreshCw, X, HardDrive, Mail, Star, AlertOctagon,
  Users, Tag, CheckCircle2, ChevronRight, Inbox, Clock, ArrowLeft
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import api from '../../services/api'

export default function AIInsightsView() {
  const { setCurrentView, openEmail, showNotification } = useApp()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [insights, setInsights] = useState(null)

  const fetchInsights = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const { data } = await api.get('/api/emails/insights')
      if (data.success && data.insights) {
        setInsights(data.insights)
        if (isManualRefresh) showNotification('AI Digest refreshed with latest Gmail sync data!', 'success')
      } else {
        throw new Error('Could not compute email insights')
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load AI Insights'
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [])

  return (
    <div className="flex flex-col h-full view-enter bg-[#0e1219] text-[#e6edf3] overflow-y-auto select-none">
      {/* ── 1. Top Header Banner ─────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-[#262c36] bg-[#11161d] flex items-center justify-between flex-shrink-0 sticky top-0 z-10 backdrop-blur-md bg-opacity-90">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">AI Insights &amp; Digest</h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                GROQ AI ENGINE
              </span>
            </div>
            <p className="text-xs text-[#8b949e]">Real-time intelligence from your synchronized Gmail mailbox</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="ai-insights-refresh-btn"
            onClick={() => fetchInsights(true)}
            disabled={loading || refreshing}
            className="px-3 py-1.5 rounded-xl bg-[#181f2a] hover:bg-[#202734] border border-[#262c36] text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Digest'}</span>
          </button>

          <button
            id="ai-insights-close-btn"
            onClick={() => setCurrentView('inbox')}
            className="px-3 py-1.5 rounded-xl bg-[#181f2a] hover:bg-[#202734] border border-[#262c36] text-xs font-semibold text-[#8b949e] hover:text-white flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft size={14} />
            <span>Back to Inbox</span>
          </button>
        </div>
      </div>

      {/* ── 2. Content Body ─────────────────────────────────────── */}
      <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
        {loading ? (
          /* Loading State */
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-[#11161d] rounded-2xl border border-[#262c36] animate-pulse p-4 space-y-3">
                  <div className="skeleton h-4 w-1/2 rounded" />
                  <div className="skeleton h-6 w-1/3 rounded" />
                </div>
              ))}
            </div>
            <div className="h-40 bg-[#11161d] rounded-2xl border border-[#262c36] animate-pulse p-6 space-y-3">
              <div className="skeleton h-5 w-1/4 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
            <AlertOctagon size={32} className="mx-auto text-rose-400" />
            <h3 className="text-base font-bold text-white">Could not generate AI Insights</h3>
            <p className="text-xs text-[#8b949e]">{error}</p>
            <button
              onClick={() => fetchInsights(true)}
              className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : insights ? (
          <>
            {/* ── 4 Key Metric Cards ───────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[#11161d] border border-[#262c36] flex items-center gap-4 hover:border-indigo-500/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <HardDrive size={20} />
                </div>
                <div>
                  <p className="text-xs text-[#8b949e] font-medium">Emails Analyzed</p>
                  <p className="text-xl font-extrabold text-white font-mono">{insights.stats?.totalAnalyzed?.toLocaleString() || 0}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#11161d] border border-[#262c36] flex items-center gap-4 hover:border-sky-500/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="text-xs text-[#8b949e] font-medium">Unread Messages</p>
                  <p className="text-xl font-extrabold text-white font-mono">{insights.stats?.unread?.toLocaleString() || 0}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#11161d] border border-[#262c36] flex items-center gap-4 hover:border-rose-500/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertOctagon size={20} />
                </div>
                <div>
                  <p className="text-xs text-[#8b949e] font-medium">Important Emails</p>
                  <p className="text-xl font-extrabold text-white font-mono">{insights.stats?.important?.toLocaleString() || 0}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#11161d] border border-[#262c36] flex items-center gap-4 hover:border-amber-500/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Star size={20} />
                </div>
                <div>
                  <p className="text-xs text-[#8b949e] font-medium">Starred Messages</p>
                  <p className="text-xl font-extrabold text-white font-mono">{insights.stats?.starred?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>

            {/* ── Executive AI Summary Card ────────────────────── */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-[#161d2a] via-[#11161d] to-[#181f2a] border border-cyan-500/30 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full filter blur-3xl pointer-events-none" />
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Executive AI Summary</h3>
              </div>
              <p className="text-sm text-[#c9d1d9] leading-relaxed font-normal">
                {insights.summary}
              </p>

              {/* Key Topics Tags */}
              {insights.topics && insights.topics.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#262c36]/60 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#8b949e] uppercase tracking-wider mr-1 flex items-center gap-1">
                    <Tag size={12} /> Key Topics:
                  </span>
                  {insights.topics.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-semibold px-3 py-1 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Grid: Top Senders & Action Needed ────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Top Senders */}
              <div className="p-5 rounded-2xl bg-[#11161d] border border-[#262c36] space-y-4">
                <div className="flex items-center justify-between border-b border-[#262c36] pb-3">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Top Active Senders</h3>
                  </div>
                  <span className="text-xs text-[#8b949e]">Volume</span>
                </div>

                <div className="space-y-2.5">
                  {insights.topSenders && insights.topSenders.length > 0 ? (
                    insights.topSenders.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#181f2a] border border-[#262c36]/70">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-xs font-bold text-white truncate">{s.name}</p>
                          <p className="text-[11px] text-[#8b949e] truncate">{s.email}</p>
                        </div>
                        <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {s.count} email{s.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#8b949e] py-4 text-center">No sender activity recorded</p>
                  )}
                </div>
              </div>

              {/* Right: Pending Action Items */}
              <div className="p-5 rounded-2xl bg-[#11161d] border border-[#262c36] space-y-4">
                <div className="flex items-center justify-between border-b border-[#262c36] pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Pending Action Items</h3>
                  </div>
                  <span className="text-xs text-[#8b949e]">{insights.actionItems?.length || 0} items</span>
                </div>

                <div className="space-y-2.5">
                  {insights.actionItems && insights.actionItems.length > 0 ? (
                    insights.actionItems.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => openEmail(item.id)}
                        className="w-full text-left p-3 rounded-xl bg-[#181f2a] hover:bg-[#202734] border border-[#262c36] transition-all group flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                            <p className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                              {item.subject}
                            </p>
                          </div>
                          <p className="text-[11px] text-[#8b949e] truncate pl-3.5">{item.sender}</p>
                        </div>
                        <ChevronRight size={15} className="text-[#8b949e] group-hover:text-white transition-colors" />
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-[#8b949e] py-4 text-center">No pending action items detected</p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
