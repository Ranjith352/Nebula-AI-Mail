'use strict'

/**
 * Auth Routes — Google OAuth 2.0 flow endpoints.
 *
 * Route map:
 *   GET /auth/google          → Redirect to Google consent screen
 *   GET /auth/callback        → Handle Google redirect (exchange code → tokens)
 *   GET /auth/me              → Return safe user profile (no tokens)
 *   GET /auth/status          → Lightweight auth check (200 | 401)
 *   GET /auth/logout          → Destroy session and clear cookie
 *
 * Security guarantees:
 *   - NEVER returns tokens, historyId, watchExpiry, or any internal fields
 *   - NEVER exposes client secret (stays in .env / server process only)
 *   - Session cookie is httpOnly, sameSite, and secure in production
 */

const express  = require('express')
const passport = require('../config/passport')
const { requireAuth } = require('../middleware/auth.middleware')

const router = express.Router()

const CLIENT_URL    = process.env.CLIENT_URL || 'http://localhost:5173'
const GMAIL_SCOPES  = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/gmail.modify',
]

/* ══════════════════════════════════════════════════════════════════
   Step 1 — GET /auth/google
   Redirect the browser to Google's OAuth consent screen.
   access_type=offline  → get a refresh_token (needed for background sync)
   prompt=consent       → always show consent, guarantees refresh_token is issued
   ══════════════════════════════════════════════════════════════════ */
router.get(
  '/google',
  passport.authenticate('google', {
    scope:       GMAIL_SCOPES,
    accessType:  'offline',
    prompt:      'consent',   // guarantee refresh_token on every auth
    includeGrantedScopes: true,
  })
)

/* ══════════════════════════════════════════════════════════════════
   Step 2 — GET /auth/callback
   Google redirects here with an authorization code.
   Passport exchanges the code for access_token + refresh_token,
   calls the verify callback in passport.js (which upserts User + OAuthToken),
   then establishes a session.
   ══════════════════════════════════════════════════════════════════ */
router.get(
  '/callback',
  passport.authenticate('google', {
    failureRedirect: `${CLIENT_URL}/?error=auth_failed`,
    failureMessage:  true,
  }),
  async (req, res) => {
    // At this point req.user is set and session is persisted.
    // Kick off Gmail Watch subscription (best-effort — never blocks login).
    try {
      const { gmailService } = require('../services/gmail.service')
      const svc   = gmailService(req.user)
      const watch = await svc.watchMailbox()
      if (watch) {
        req.user.historyId   = watch.historyId
        req.user.watchExpiry = new Date(parseInt(watch.expiration, 10))
        await req.user.save()
        console.log(`[Auth] Gmail Watch activated for ${req.user.email}`)
      }
    } catch (err) {
      // Non-fatal — app works without real-time push (falls back to polling/manual refresh)
      console.warn(`[Auth] Gmail Watch skipped for ${req.user.email}:`, err.message)
    }

    console.log(`[Auth] ✅ Login complete — ${req.user.email}`)
    res.redirect(`${CLIENT_URL}/`)
  }
)

/* ══════════════════════════════════════════════════════════════════
   GET /auth/me
   Returns the authenticated user's SAFE public profile.
   Called by the React app on boot to restore session state.

   Response shape (tokens are NEVER included):
   { user: { id, email, name, picture } }
   ══════════════════════════════════════════════════════════════════ */
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ user: null })
  }

  // User.toJSON() already strips all internal fields (see User.js)
  const { _id, email, name, picture } = req.user
  res.json({
    user: {
      id:      _id,
      email,
      name,
      picture,
    },
  })
})

/* ══════════════════════════════════════════════════════════════════
   GET /auth/status
   Lightweight auth check — no body. Returns 200 if logged in, 401 if not.
   Used by middleware to guard API routes without parsing req.user.
   ══════════════════════════════════════════════════════════════════ */
router.get('/status', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ authenticated: false })
  }
  res.json({ authenticated: true, email: req.user.email })
})

/* ══════════════════════════════════════════════════════════════════
   GET /auth/logout
   Fully destroys the session and clears the cookie.
   ══════════════════════════════════════════════════════════════════ */
router.get('/logout', requireAuth, (req, res) => {
  const email = req.user?.email || 'unknown'
  req.logout(err => {
    if (err) console.error('[Auth] Logout error:', err)
    req.session.destroy(() => {
      res.clearCookie('connect.sid', {
        path:     '/',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure:   process.env.NODE_ENV === 'production',
      })
      console.log(`[Auth] Session destroyed for ${email}`)
      res.json({ success: true })
    })
  })
})

/* ══════════════════════════════════════════════════════════════════
   GET /auth/demo-login
   Instant Sandbox / Demo login for testing without Google Cloud test user restrictions.
   ══════════════════════════════════════════════════════════════════ */
router.get('/demo-login', async (req, res) => {
  try {
    const User = require('../models/User')
    let user = await User.findOne({ email: 'demo.user@nebulamail.app' })
    if (!user) {
      user = await User.create({
        googleId: 'demo-google-id-123456',
        email:    'demo.user@nebulamail.app',
        name:     'Demo Evaluator',
        picture:  'https://lh3.googleusercontent.com/a/default-user',
      })
    }
    req.login(user, err => {
      if (err) {
        console.error('[Auth] Demo login error:', err)
        return res.status(500).json({ error: 'Demo login failed' })
      }
      console.log(`[Auth] ✅ Demo login complete — ${user.email}`)
      return res.redirect(`${CLIENT_URL}/`)
    })
  } catch (err) {
    console.error('[Auth] Demo login exception:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

