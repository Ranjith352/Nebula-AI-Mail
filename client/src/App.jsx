import React from 'react'
import { AppProvider } from './context/AppContext'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/ui/ErrorBoundary'

export default function App() {
  return (
    <AppProvider>
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </AppProvider>
  )
}
