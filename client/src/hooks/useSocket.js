import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useApp } from '../context/AppContext'

/**
 * Connects to Socket.io, subscribes to user-specific room, and handles real-time push events.
 *
 * Real-Time Architecture Pipeline:
 *   Gmail → Gmail Watch → Google Pub/Sub → Express Webhook → historyId → Gmail History API → Sync Service → MongoDB & Socket.IO (User-Specific Room) → React Inbox Update
 *
 * Events Handled:
 * - mail:new      (New email pushed)
 * - mail:updated  (Email read/unread or thread modified)
 * - mail:deleted  (Email deleted)
 * - sync:complete (Inbox sync finished)
 */
export default function useSocket() {
  const {
    user,
    prependEmail,
    handleEmailSent,
    updateEmailState,
    removeEmailState,
    handleSyncComplete,
    fetchInbox,
  } = useApp()

  const socketRef = useRef(null)

  useEffect(() => {
    if (!user || (!user.email && !user.id)) return

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000'
    const userIdentifier = user.email || user.id

    socketRef.current = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        userId: user.id || user._id,
        email: user.email,
      },
    })

    // Connect handler
    socketRef.current.on('connect', () => {
      console.log('[Socket.io] 🟢 Connected successfully:', socketRef.current.id)
      // Join isolated user room for targeted notifications
      socketRef.current.emit('join-user-room', userIdentifier)
    })

    // Reconnect handlers
    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log(`[Socket.io] 🔄 Reconnected after ${attemptNumber} attempts`)
      socketRef.current.emit('join-user-room', userIdentifier)
      fetchInbox()
    })

    socketRef.current.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket.io] Reconnecting (Attempt ${attempt})...`)
    })

    // 1. mail:new event
    const handleMailNew = (emailData) => {
      console.log('[Socket.io] 📬 mail:new received:', emailData.subject)
      prependEmail(emailData)
    }

    // 2. email:sent / mail:sent event
    const handleSentEvent = (emailData) => {
      console.log('[Socket.io] 📤 email:sent received:', emailData.subject)
      handleEmailSent(emailData)
    }

    // 3. mail:updated event
    const handleMailUpdated = (emailData) => {
      console.log('[Socket.io] ✏️ mail:updated received for ID:', emailData.id)
      updateEmailState(emailData)
    }

    // 4. mail:deleted event
    const handleMailDeleted = (emailData) => {
      console.log('[Socket.io] 🗑️ mail:deleted received for ID:', emailData.id || emailData)
      const targetId = typeof emailData === 'string' ? emailData : emailData.id
      removeEmailState(targetId)
    }

    // 5. sync:complete event
    const handleSyncFinished = (stats) => {
      console.log('[Socket.io] ⚡ sync:complete received:', stats)
      handleSyncComplete(stats)
    }

    // Bind event listeners
    socketRef.current.on('mail:new', handleMailNew)
    socketRef.current.on('new-email', handleMailNew) // backwards compatibility
    socketRef.current.on('email:sent', handleSentEvent)
    socketRef.current.on('mail:sent', handleSentEvent)
    socketRef.current.on('mail:updated', handleMailUpdated)
    socketRef.current.on('mail:deleted', handleMailDeleted)
    socketRef.current.on('sync:complete', handleSyncFinished)

    // Legacy resync trigger
    socketRef.current.on('inbox-resynced', () => {
      console.log('[Socket.io] 🔄 Full inbox resync notification received')
      fetchInbox()
    })

    // Disconnect handler
    socketRef.current.on('disconnect', (reason) => {
      console.log('[Socket.io] 🔴 Disconnected:', reason)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.off('mail:new', handleMailNew)
        socketRef.current.off('new-email', handleMailNew)
        socketRef.current.off('email:sent', handleSentEvent)
        socketRef.current.off('mail:sent', handleSentEvent)
        socketRef.current.off('mail:updated', handleMailUpdated)
        socketRef.current.off('mail:deleted', handleMailDeleted)
        socketRef.current.off('sync:complete', handleSyncFinished)
        socketRef.current.off('inbox-resynced')
        socketRef.current.disconnect()
      }
    }
  }, [user, prependEmail, handleEmailSent, updateEmailState, removeEmailState, handleSyncComplete, fetchInbox])

  return socketRef
}

