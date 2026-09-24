import { useApp } from '../context/AppContext'

/**
 * Custom hook providing AI assistant state controls and view dispatchers
 */
export function useAssistant() {
  const {
    currentView,
    setCurrentView,
    composeData,
    setComposeData,
    filters,
    setFilters,
    showNotification,
  } = useApp()

  return {
    currentView,
    setCurrentView,
    composeData,
    setComposeData,
    filters,
    setFilters,
    showNotification,
  }
}
