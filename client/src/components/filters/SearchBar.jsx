import React, { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function SearchBar() {
  const { searchEmails, fetchInbox } = useApp()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!query.trim()) {
      fetchInbox()
      return
    }
    setSearching(true)
    await searchEmails(query)
    setSearching(false)
  }

  const handleClear = () => {
    setQuery('')
    fetchInbox()
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
      <input
        id="standalone-search-input"
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search emails..."
        className="w-full bg-[#21262d] border border-[#30363d] rounded-xl pl-9 pr-9 py-2 text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-indigo-500 transition-colors"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#e6edf3]"
        >
          <X size={14} />
        </button>
      )}
    </form>
  )
}
