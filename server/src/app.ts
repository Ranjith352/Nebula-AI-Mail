import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import passport from './config/passport'
import { env } from './config/env'
import { errorHandler } from './middleware/error.middleware'

// Routes
import authRoutes from './routes/auth.routes'
import emailRoutes from './routes/email.routes'
import assistantRoutes from './routes/assistant.routes'
import webhookRoutes from './routes/webhook.routes'

export function createApp(): Express {
  const app = express()

  // CORS Configuration
  const allowedOrigins = [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174']
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
        cb(new Error(`CORS origin ${origin} not allowed`))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )

  // Body parser middleware
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  // Express Session Configuration
  const sessionConfig: session.SessionOptions = {
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  }

  if (env.MONGODB_URI && !env.MONGODB_URI.includes('<user>')) {
    sessionConfig.store = MongoStore.create({
      mongoUrl: env.MONGODB_URI,
      dbName: 'nebula',
      ttl: 7 * 24 * 60 * 60,
    })
  }

  app.use(session(sessionConfig))

  // Passport Initialization
  app.use(passport.initialize())
  app.use(passport.session())

  // Route Mounts
  app.use('/auth', authRoutes)
  app.use('/api/emails', emailRoutes)
  app.use('/api/assistant', assistantRoutes)
  app.use('/api/webhook', webhookRoutes)

  // Health Check Endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      port: env.PORT,
      auth: (req as any).isAuthenticated?.() ? (req.user as any)?.email : null,
    })
  })

  // Global Error Handler
  app.use(errorHandler)

  return app
}
