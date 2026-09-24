import React from 'react'
import { RotateCcw, Search, Filter } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const DATE_RANGES = [
  { value: 'all',    label: 'All time' },
  { value: 'today',  label: 'Today' },
  { value: 'week',   label: 'Last 7 days' },
  { value: '10days', label: 'Last 10 days' },
  { value: 'month',  label: 'Last 30 days' },
]

export default function FilterPanel() {
  const { filters, setFilters } = useApp()

  const update = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))

  const handleReset = () => {
    setFilters({ unreadOnly: false, dateRange: 'all', sender: '', keyword: '' })
  }

  const hasActiveFilters = filters.unreadOnly || filters.dateRange !== 'all' || filters.sender || filters.keyword

  return (
    <div className="px-5 py-3 border-b border-[#30363d] bg-[#161b22] flex items-center gap-4 flex-shrink-0 flex-wrap">
      {/* 1. Read / Unread toggle */}
      <label id="unread-filter-toggle" className="flex items-center gap-2 cursor-pointer select-none">
        <div
          onClick={() => update('unreadOnly', !filters.unreadOnly)}
          className={`relative w-8 h-4.5 rounded-full transition-colors duration-200 flex items-center ${
            filters.unreadOnly ? 'bg-indigo-500' : 'bg-[#30363d]'
          }`}
          style={{ height: '18px' }}
        >
          <div
            className={`absolute w-3 h-3 bg-white rounded-full transition-transform duration-200 ${
              filters.unreadOnly ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </div>
        <span className="text-xs font-medium text-[#8b949e]">Unread only</span>
      </label>

      {/* 2. Date range controls */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-[#8b949e]">Date:</span>
        <div className="flex gap-1">
          {DATE_RANGES.map(r => {
            const dr = String(filters.dateRange || '').toLowerCase()
            const isActive =
              filters.dateRange === r.value ||
              (r.value === '10days' && (dr === '10' || dr.includes('10'))) ||
              (r.value === 'week' && (dr === '7' || dr.includes('week') || dr.includes('7'))) ||
              (r.value === 'today' && dr.includes('today')) ||
              (r.value === 'month' && (dr === '30' || dr.includes('month') || dr.includes('30')))

            return (
              <button
                key={r.value}
                id={`date-filter-${r.value}`}
                onClick={() => update('dateRange', r.value)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Sender filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-[#8b949e]">From:</span>
        <input
          id="sender-filter-input"
          type="text"
          value={filters.sender || ''}
          onChange={e => update('sender', e.target.value)}
          placeholder="e.g. Sarah"
          className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1 text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-indigo-500 w-28 transition-colors"
        />
      </div>

      {/* 4. Keyword filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-[#8b949e]">Keyword:</span>
        <input
          id="keyword-filter-input"
          type="text"
          value={filters.keyword || ''}
          onChange={e => update('keyword', e.target.value)}
          placeholder="e.g. meeting"
          className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1 text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-indigo-500 w-28 transition-colors"
        />
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-colors ml-auto"
        >
          <RotateCcw size={11} />
          <span>Reset</span>
        </button>
      )}
    </div>
  )
}
