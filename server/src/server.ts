import http from 'http'
import { createApp } from './app'
import { env } from './config/env'
import { connectDB } from './config/db'
import { initSocket } from './socket/socket'

async function startServer() {
  const app = createApp()
  const server = http.createServer(app)

  // Initialize Socket.io
  initSocket(server)

  // Connect to MongoDB Atlas
  await connectDB()

  // Start HTTP Listener
  server.listen(env.PORT, () => {
    console.log(`
╔═════════════════════════════════════════════════════╗
║               Nebula Mail Server                    ║
╠═════════════════════════════════════════════════════╣
║  Server:     http://localhost:${env.PORT}                  ║
║  OAuth:      http://localhost:${env.PORT}/auth/google       ║
║  Callback:   http://localhost:${env.PORT}/auth/callback     ║
║  Assistant:  http://localhost:${env.PORT}/api/assistant/chat║
║  Health:     http://localhost:${env.PORT}/health            ║
╚═════════════════════════════════════════════════════╝
    `)
  })

  process.on('SIGTERM', () => {
    console.log('[Server] Shutting down gracefully...')
    server.close(() => process.exit(0))
  })
}

startServer().catch((err) => {
  console.error('[Server Startup Fatal Error]', err)
})
