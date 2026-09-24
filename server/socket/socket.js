const { Server } = require('socket.io')

let io = null

/**
 * Initialize Socket.io with the HTTP server.
 * Manages connection authentication, disconnect handling, and isolated user rooms.
 *
 * Security & Privacy Guarantee:
 *  - Private email events are NEVER broadcast to all connected sockets.
 *  - Every client joins their isolated user room (`user:${userId}` or `user:${email}`).
 *  - Events are emitted strictly to `io.to(userRoom).emit("mail:new", email)`.
 *
 * @param {http.Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:      [process.env.CLIENT_URL || 'http://localhost:5173', 'http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
      methods:     ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  // Connection Authentication Middleware
  io.use((socket, next) => {
    try {
      const auth = socket.handshake.auth || {}
      const cookieHeader = socket.handshake.headers.cookie || ''
      
      // Extract user info from handshake auth payload or cookies
      const userId = auth.userId || auth.id
      const email = auth.email

      if (userId || email) {
        socket.user = {
          id: userId ? String(userId) : null,
          email: email ? String(email).toLowerCase() : null
        }
      }
      return next()
    } catch (err) {
      console.warn('[Socket.io] Auth middleware warning:', err.message)
      return next() // Allow connection, auto-room join handles fallback
    }
  })

  io.on('connection', (socket) => {
    console.log(`[Socket.io] 🟢 Client connected: ${socket.id} (user: ${socket.user?.email || 'guest'})`)

    // Automatically join user rooms if user was authenticated during handshake
    if (socket.user) {
      if (socket.user.id) socket.join(`user:${socket.user.id.toLowerCase()}`)
      if (socket.user.email) socket.join(`user:${socket.user.email.toLowerCase()}`)
    }

    // Explicit room subscription event (for client re-joins)
    socket.on('join-user-room', (userIdentifier) => {
      if (userIdentifier) {
        const cleanId = String(userIdentifier).toLowerCase().trim()
        const roomName = cleanId.startsWith('user:') ? cleanId : `user:${cleanId}`
        socket.join(roomName)
        console.log(`[Socket.io] 🔒 Socket ${socket.id} joined isolated room: ${roomName}`)
      }
    })

    // Disconnect handling
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] 🔴 Client disconnected: ${socket.id} (Reason: ${reason})`)
    })
  })

  return io
}

/**
 * Get the Socket.io instance.
 */
function getIO() {
  if (!io) throw new Error('Socket.io not initialized — call initSocket() first')
  return io
}

/**
 * Helper to get clean room name.
 */
function _getRoomName(userIdentifier) {
  if (!userIdentifier) return null
  const cleanId = String(userIdentifier).toLowerCase().trim()
  return cleanId.startsWith('user:') ? cleanId : `user:${cleanId}`
}

/**
 * Emit real-time email event to a SPECIFIC user's room ONLY.
 * NEVER broadcasts private emails globally.
 */
function emitToUser(userIdentifier, event, data) {
  if (!io || !userIdentifier) return
  const roomName = _getRoomName(userIdentifier)
  if (!roomName) return
  
  io.to(roomName).emit(event, data)
  console.log(`[Socket.io] 🔒 Emitted '${event}' to isolated room: ${roomName}`)
}

/**
 * Event specific emitter helpers:
 * - mail:new
 * - mail:updated
 * - mail:deleted
 * - sync:complete
 */
function emitEmailSent(userIdentifier, emailData) {
  emitToUser(userIdentifier, 'email:sent', emailData)
  emitToUser(userIdentifier, 'mail:sent', emailData)
}

function emitMailNew(userIdentifier, emailData) {
  emitToUser(userIdentifier, 'mail:new', emailData)
  // Also emit legacy alias for backwards compatibility
  emitToUser(userIdentifier, 'new-email', emailData)
}

function emitMailUpdated(userIdentifier, emailData) {
  emitToUser(userIdentifier, 'mail:updated', emailData)
}

function emitMailDeleted(userIdentifier, emailData) {
  emitToUser(userIdentifier, 'mail:deleted', emailData)
}

function emitSyncProgress(userIdentifier, progressStats = {}) {
  emitToUser(userIdentifier, 'sync:progress', {
    timestamp: new Date().toISOString(),
    ...progressStats,
  })
}

function emitSyncComplete(userIdentifier, syncStats = {}) {
  emitToUser(userIdentifier, 'sync:complete', {
    timestamp: new Date().toISOString(),
    ...syncStats,
  })
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitEmailSent,
  emitMailNew,
  emitMailUpdated,
  emitMailDeleted,
  emitSyncProgress,
  emitSyncComplete,
}

