'use strict'

/**
 * Passport.js — Google OAuth 2.0 strategy configuration.
 *
 * Security guarantees:
 *  - Client secret NEVER leaves this file / server process.
 *  - Tokens stored in OAuthToken collection, NOT on the User document.
 *  - Session only stores the user._id (Mongoose ObjectId), nothing else.
 *  - access_type=offline  → Google returns a refresh_token.
 *  - prompt=consent       → Always re-consent, guaranteeing a fresh refresh_token.
 *  - Minimum necessary Gmail scopes only.
 */

const passport       = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User           = require('../models/User')
const OAuthToken     = require('../models/OAuthToken')

/* ─────────────────────────────────────────────────────────────── */
/* Minimum necessary Gmail API scopes                               */
/*                                                                  */
/* gmail.modify covers:                                             */
/*   - Read messages (inbox, sent, labels)                          */
/*   - Send messages                                                */
/*   - Modify labels (mark read/unread)                             */
/*   - Create and manage drafts                                     */
/*   - Watch mailbox (push notifications)                           */
/* ─────────────────────────────────────────────────────────────── */
const GMAIL_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/gmail.modify',
]

/* ─────────────────────────────────────────────────────────────── */
/* Session serialization — store ONLY the MongoDB _id             */
/* ─────────────────────────────────────────────────────────────── */
passport.serializeUser((user, done) => {
  done(null, user._id.toString())
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).lean()
    if (!user) return done(null, false)
    // Re-attach internal fields needed by GmailService (not serialized to clients)
    const raw = await User.findById(id)
    done(null, raw)
  } catch (err) {
    done(err, null)
  }
})

/* ─────────────────────────────────────────────────────────────── */
/* Google OAuth 2.0 Strategy                                        */
/* ─────────────────────────────────────────────────────────────── */
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
      // Pass the raw token response through to the verify callback
      passReqToCallback: false,
    },
    async (accessToken, refreshToken, params, profile, done) => {
      try {
        /* ── 1. Upsert User (profile data only) ───────────────── */
        let user = await User.findOne({ googleId: profile.id })

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email:    profile.emails[0].value,
            name:     profile.displayName,
            picture:  profile.photos?.[0]?.value || '',
          })
          console.log(`[OAuth] New user created: ${user.email}`)
        } else {
          // Refresh profile fields in case Google profile changed
          user.name    = profile.displayName
          user.picture = profile.photos?.[0]?.value || user.picture
          await user.save()
        }

        /* ── 2. Persist tokens securely in OAuthToken ─────────── */
        const tokenData = {
          accessToken,
          expiryDate: params.expires_in
            ? Date.now() + params.expires_in * 1000
            : null,
          scope: params.scope || GMAIL_SCOPES.join(' '),
        }

        // Only overwrite refreshToken if Google sent a new one
        // (Google omits it on subsequent logins unless prompt=consent)
        if (refreshToken) {
          tokenData.refreshToken = refreshToken
        }

        await OAuthToken.findOneAndUpdate(
          { userId: user._id },
          { $set: tokenData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )

        console.log(`[OAuth] Tokens stored for ${user.email} (refresh: ${refreshToken ? 'YES' : 'reused'})`)

        return done(null, user)
      } catch (err) {
        console.error('[OAuth] Strategy error:', err.message)
        return done(err, null)
      }
    }
  )
)

module.exports = passport
