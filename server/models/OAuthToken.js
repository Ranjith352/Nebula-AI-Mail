const mongoose = require('mongoose')

/**
 * OAuthToken — secure storage for Google OAuth 2.0 tokens.
 *
 * Security rules enforced here:
 *  - Tokens are NEVER included in /auth/me or any API response to the frontend.
 *  - The only code that reads tokens is GmailService (server-side only).
 *  - Tokens are loaded by userId reference, never by email or other public field.
 */
const oauthTokenSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,   // one token record per user
      index:    true,
    },
    accessToken: {
      type:     String,
      required: true,
    },
    refreshToken: {
      type:    String,
      default: '',
    },
    // Epoch ms — when the access token expires (from Google's token response)
    expiryDate: {
      type:    Number,
      default: null,
    },
    // The Gmail scope set that was granted
    scope: {
      type:    String,
      default: '',
    },
  },
  { timestamps: true }
)

// Never return tokens in JSON serialization (extra safety net)
oauthTokenSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.accessToken
    delete ret.refreshToken
    delete ret.expiryDate
    return ret
  },
})

module.exports = mongoose.model('OAuthToken', oauthTokenSchema)
