import mongoose, { Schema, Document } from 'mongoose'

export interface IEmailCache extends Document {
  userId: mongoose.Types.ObjectId
  gmailId: string
  threadId: string
  from: string
  sender: string
  senderEmail: string
  to: string
  recipients: string[]
  subject: string
  snippet: string
  date: Date
  receivedAt: Date
  isRead: boolean
  labels: string[]
  bodyText: string
  bodyHtml: string
}

const emailCacheSchema = new Schema<IEmailCache>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gmailId:     { type: String, required: true, index: true },
    threadId:    { type: String, default: '' },
    from:        { type: String, default: '' },
    sender:      { type: String, default: '' },
    senderEmail: { type: String, default: '' },
    to:          { type: String, default: '' },
    recipients:  [{ type: String }],
    subject:     { type: String, default: '' },
    snippet:     { type: String, default: '' },
    date:        { type: Date,   default: Date.now },
    receivedAt:  { type: Date,   default: Date.now },
    isRead:      { type: Boolean, default: true },
    labels:      [{ type: String }],
    bodyText:    { type: String, default: '' },
    bodyHtml:    { type: String, default: '' },
  },
  { timestamps: true, strict: false }
)

emailCacheSchema.index({ userId: 1, gmailId: 1 }, { unique: true })
emailCacheSchema.index({ userId: 1, labels: 1, receivedAt: -1 })
emailCacheSchema.index({ userId: 1, threadId: 1 })

export default mongoose.model<IEmailCache>('EmailCache', emailCacheSchema)
