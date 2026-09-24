require('dotenv').config()

const express        = require('express')
const http           = require('http')
const cors           = require('cors')
const session        = require('express-session')
const MongoStore     = require('connect-mongo')
const passport       = require('./config/passport')
const { connectDB }  = require('./config/db')
const { initSocket } = require('./socket/socket')

const {
  apiRateLimiter,
  securityHeaders,
  enforceHttps,
  sanitizeInput,
} = require('./middleware/security.middleware')

// Routes
const authRoutes      = require('./routes/auth.routes')
const emailRoutes     = require('./routes/email.routes')
const assistantRoutes = require('./routes/assistant.routes')
const webhookRoutes   = require('./routes/webhook.routes')

/* ─────────────────────────────────────────────────────────────── */
/* Bootstrap                                                        */
/* ─────────────────────────────────────────────────────────────── */
const app    = express()
const server = http.createServer(app)

// Trust proxy in production for rate limiter & HTTPS header parsing
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

// Security Middleware Suite
app.use(securityHeaders)
app.use(enforceHttps)
app.use(apiRateLimiter(200, 15 * 60 * 1000))

// Socket.io
initSocket(server)

// MongoDB (non-fatal if missing)
connectDB()

/* ─────────────────────────────────────────────────────────────── */
/* CORS                                                             */
/* ─────────────────────────────────────────────────────────────── */
const CLIENT_ORIGINS = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || CLIENT_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

/* ─────────────────────────────────────────────────────────────── */
/* Body Parsers & Sanitizer                                         */
/* ─────────────────────────────────────────────────────────────── */
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(sanitizeInput)


/* ─────────────────────────────────────────────────────────────── */
/* Session                                                          */
/* ─────────────────────────────────────────────────────────────── */
const sessionConfig = {
  secret:            process.env.SESSION_SECRET || 'nebula-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}

const MONGODB_URI = process.env.MONGODB_URI
if (MONGODB_URI && !MONGODB_URI.includes('<user>')) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: MONGODB_URI,
    dbName:   'nebula',
    ttl:      7 * 24 * 60 * 60,
  })
  console.log('[Session] Using MongoDB session store')
} else {
  console.warn('[Session] Using in-memory session store (add MONGODB_URI to server/.env for persistence)')
}

app.use(session(sessionConfig))

// Passport
app.use(passport.initialize())
app.use(passport.session())

/* ─────────────────────────────────────────────────────────────── */
/* REST API Routes                                                   */
/* ─────────────────────────────────────────────────────────────── */
app.use('/auth',          authRoutes)      // /auth/google, /auth/callback, /auth/me, /auth/logout
app.use('/api/emails',    emailRoutes)     // all require session auth
app.use('/api/labels',    emailRoutes)     // alias for /api/emails/labels compatibility
app.use('/api/assistant', assistantRoutes) // /api/assistant/chat (Native Express Groq AI pipeline)
app.use('/api/webhook',   webhookRoutes)   // Pub/Sub push endpoint

/* ─────────────────────────────────────────────────────────────── */
/* Health check                                                     */
/* ─────────────────────────────────────────────────────────────── */
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    port:      process.env.PORT || 8000,
    auth:      req.isAuthenticated() ? req.user?.email : null,
  })
})

/* ─────────────────────────────────────────────────────────────── */
/* Global error handler                                             */
/* ─────────────────────────────────────────────────────────────── */
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message)
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
})

/* ─────────────────────────────────────────────────────────────── */
/* Start                                                            */
/* ─────────────────────────────────────────────────────────────── */
const PORT = parseInt(process.env.PORT || '8000', 10)

server.listen(PORT, () => {
  console.log(`
╔═════════════════════════════════════════════════════╗
║               Nebula Mail Server                    ║
╠═════════════════════════════════════════════════════╣
║  Server:     http://localhost:${PORT}                  ║
║  OAuth:      http://localhost:${PORT}/auth/google       ║
║  Callback:   http://localhost:${PORT}/auth/callback     ║
║  Assistant:  http://localhost:${PORT}/api/assistant/chat║
║  Health:     http://localhost:${PORT}/health            ║
╚═════════════════════════════════════════════════════╝
  `)
})

process.on('SIGTERM', () => {
  console.log('[Server] Shutting down gracefully...')
  server.close(() => process.exit(0))
})
