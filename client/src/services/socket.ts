import { io, Socket } from 'socket.io-client'

let socketInstance: Socket | null = null

/**
 * Initializes and returns the shared Socket.IO instance
 */
export function getSocket(serverUrl?: string): Socket {
  if (socketInstance && socketInstance.connected) {
    return socketInstance
  }

  const url = serverUrl || import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000'

  socketInstance = io(url, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  })

  return socketInstance
}

/**
 * Subscribes socket to user-specific room
 */
export function joinUserRoom(email: string): void {
  const socket = getSocket()
  if (socket && email) {
    socket.emit('join-user-room', email)
  }
}
