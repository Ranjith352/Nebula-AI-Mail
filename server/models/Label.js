const mongoose = require('mongoose')

const labelSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    id:              { type: String, required: true },
    name:            { type: String, required: true },
    type:            { type: String, enum: ['system', 'user'], default: 'user' },
    messagesTotal:   { type: Number, default: 0 },
    messagesUnread:  { type: Number, default: 0 },
    threadsTotal:    { type: Number, default: 0 },
    threadsUnread:   { type: Number, default: 0 },
    color: {
      textColor:       { type: String, default: '#ffffff' },
      backgroundColor: { type: String, default: '#4285f4' },
    },
  },
  { timestamps: true }
)

// Unique index so we never cache duplicate labels per user
labelSchema.index({ userId: 1, id: 1 }, { unique: true })

module.exports = mongoose.model('Label', labelSchema)
