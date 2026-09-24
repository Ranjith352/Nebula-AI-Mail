const mongoose = require('mongoose')

/**
 * User — public profile only. NO OAuth tokens stored here.
 * Tokens live in the separate OAuthToken collection.
 *
 * Fields exposed to the frontend via /auth/me:
 *   id, email, name, picture
 *
 * Internal Gmail sync state (server-only):
 *   historyId, watchExpiry, lastSync
 */
const userSchema = new mongoose.Schema(
  {
    googleId: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    email: {
      type:     String,
      required: true,
      unique:   true,
      lowercase: true,
      trim:     true,
    },
    name: {
      type:    String,
      default: '',
    },
    picture: {
      type:    String,
      default: '',
    },

    /* ── Gmail sync state & metadata ── */
    gmailAccountEmail:     { type: String, default: '' },
    historyId:             { type: String, default: '' },
    watchExpiry:           { type: Date,   default: null },
    isWatchAvailable:      { type: Boolean, default: true },
    watchError:            { type: mongoose.Schema.Types.Mixed, default: null },
    lastSync:              { type: Date,   default: null },
    lastFullSyncAt:        { type: Date,   default: null },
    lastIncrementalSyncAt: { type: Date,   default: null },
    syncStatus:            { type: String, default: 'idle' }, // idle | syncing | completed | failed
    syncStartedAt:         { type: Date,   default: null },
    syncCompletedAt:       { type: Date,   default: null },
    syncedMessageCount:    { type: Number, default: 0 },
    syncError:             { type: String, default: '' },
  },
  { timestamps: true }
)

// Strip internal fields before sending to the wire
userSchema.set('toJSON', {
  transform(doc, ret) {
    // Only expose safe public fields
    return {
      id:      ret._id,
      email:   ret.email,
      name:    ret.name,
      picture: ret.picture,
    }
  },
})

module.exports = mongoose.model('User', userSchema)
