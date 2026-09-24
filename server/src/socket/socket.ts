import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { env } from '../config/env'

let io: SocketIOServer | null = null

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin:      [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
      methods:     ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`)

    socket.on('join-user-room', (userEmail: string) => {
      if (userEmail) {
        const roomName = `user_${userEmail.toLowerCase().trim()}`
        socket.join(roomName)
        console.log(`[Socket.io] Socket ${socket.id} joined user room: ${roomName}`)
      }
    })

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`)
    })
  })

  return io
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized — call initSocket() first')
  return io
}

export function emitToUser(userEmail: string, event: string, data: any): void {
  if (!io) return
  const roomName = `user_${userEmail.toLowerCase().trim()}`
  io.to(roomName).emit(event, data)
}
