'use strict'

/**
 * Security Middleware Suite
 * Provides rate limiting, security response headers, input sanitization, and HTTPS enforcement.
 */

// In-memory sliding window rate limiter
const rateLimitMap = new Map()

/**
 * Rate Limiter Middleware
 * Default limit: 100 requests per 15-minute window per IP.
 */
function apiRateLimiter(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    const now = Date.now()

    if (!rateLimitMap.has(clientIp)) {
      rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs })
      return next()
    }

    const record = rateLimitMap.get(clientIp)
    if (now > record.resetTime) {
      rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs })
      return next()
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        message: 'Too many requests. Please try again later.',
        retryAfterMs: record.resetTime - now,
      })
    }

    record.count += 1
    next()
  }
}

/**
 * Security Headers Middleware
 * Sets standard security headers on all outgoing HTTP responses.
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  next()
}

/**
 * HTTPS Enforcer Middleware (Production Only)
 */
function enforceHttps(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https'
    if (!isSecure) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`)
    }
  }
  next()
}

/**
 * Input Sanitizer Middleware
 * Strips script tags and malicious executable strings from request body & query params.
 */
function sanitizeInput(req, res, next) {
  function sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        // Strip script tags
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key])
      }
    }
    return obj
  }

  if (req.body) sanitize(req.body)
  if (req.query) sanitize(req.query)

  next()
}

module.exports = {
  apiRateLimiter,
  securityHeaders,
  enforceHttps,
  sanitizeInput,
}
