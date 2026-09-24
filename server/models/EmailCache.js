const mongoose = require('mongoose')

const emailCacheSchema = new mongoose.Schema(
  {
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gmailId:        { type: String, required: true },
    gmailMessageId: { type: String, default: '' },
    threadId:       { type: String, default: '' },
    from:           { type: String, default: '' },
    sender:         { type: String, default: '' },
    senderEmail:    { type: String, default: '' },
    to:             { type: String, default: '' },
    recipients:     [{ type: String }],
    subject:        { type: String, default: '' },
    snippet:        { type: String, default: '' },
    internalDate:   { type: Number, default: 0, index: true },
    date:           { type: Date,   default: null },
    receivedAt:     { type: Date,   default: null },
    isRead:         { type: Boolean, default: false },
    labels:         [{ type: String }],   // e.g. ['INBOX', 'UNREAD']
    bodyText:       { type: String, default: '' },
    bodyHtml:       { type: String, default: '' },
  },
  { timestamps: true, strict: false }
)

// Compound unique index so we never cache the same email twice per user
emailCacheSchema.index({ userId: 1, gmailId: 1 }, { unique: true })
emailCacheSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true, sparse: true })
emailCacheSchema.index({ userId: 1, internalDate: -1 })
emailCacheSchema.index({ userId: 1, labels: 1, internalDate: -1 })
emailCacheSchema.index({ userId: 1, threadId: 1 })

module.exports = mongoose.model('EmailCache', emailCacheSchema)
