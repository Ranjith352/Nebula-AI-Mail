import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[React ErrorBoundary caught error]:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] h-full bg-[#0d1117] text-[#e6edf3] p-6 text-center">
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-4 shadow-xl">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Something went wrong</h2>
          <p className="text-xs text-[#8b949e] max-w-md mb-5 leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred in this section.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <RefreshCw size={14} />
            <span>Reload Mail Application</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
